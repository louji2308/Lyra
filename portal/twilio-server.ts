import { DeepgramClient } from "@deepgram/sdk";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { step, startCall } from "./src/lib/voice/engine";
import { SCRIPT } from "./src/lib/voice/script";
import type { VoiceContext, VoiceState } from "./src/lib/voice/types";
import { synthesizeSarvamTTSMulaw } from "./src/lib/voice/sarvam";
import { identifyShopByAnyPhone, getSuggestedOrder } from "./src/lib/voice/backend";
import { supabaseAdmin } from "./src/lib/supabaseAdmin";

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
if (!deepgramApiKey) {
  throw new Error("DEEPGRAM_API_KEY not set");
}

const deepgram = new DeepgramClient({ apiKey: deepgramApiKey });

interface CallSession {
  state: VoiceState;
  ctx: VoiceContext | null;
  streamSid: string | null;
  callerPhone: string | null;
  twilioWs: WebSocket;
  deepgramWs: unknown;
  audioBuffer: Buffer[];
  isProcessing: boolean;
  greetingSent: boolean;
  markResolvers: Map<string, () => void>;
  closed: boolean;
  deepgramReady: boolean;
  lastAgentText: string;
}

const WS_PORT = parseInt(process.env.TWILIO_WS_PORT ?? "3001", 10);

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "POST" && req.url === "/api/twilio/voice") {
    const wsHost = process.env.TUNNEL_URL ?? `ws://localhost:${WS_PORT}`;
    const streamUrl = wsHost.replace(/^https?:\/\//, "ws://").replace(/\/$/, "");
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`);
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});
const wss = new WebSocketServer({ server, path: "/" });

console.log("Twilio Media Stream WebSocket server starting on port 3001...");

wss.on("connection", (ws: WebSocket) => {
  const session: CallSession = {
    state: "greeting",
    ctx: null,
    streamSid: null,
    callerPhone: null,
    twilioWs: ws,
    deepgramWs: null,
    audioBuffer: [],
    isProcessing: false,
    greetingSent: false,
    markResolvers: new Map(),
    closed: false,
    deepgramReady: false,
    lastAgentText: "",
  };

  ws.on("message", async (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      await handleTwilioMessage(session, msg);
    } catch (err) {
      console.error("Twilio message error:", err);
    }
  });

  ws.on("close", () => {
    session.closed = true;
    (session.deepgramWs as { close?: () => void })?.close?.();
    console.log("Twilio WebSocket closed");
  });

  connectDeepgram(session);
});

async function connectDeepgram(session: CallSession) {
  try {
    const connection = await deepgram.listen.v1.connect({
      model: "nova-2",
      language: "ta-IN",
      encoding: "mulaw",
      sample_rate: "8000",
      interim_results: "true",
      utterance_end_ms: "1000",
      vad_events: "true",
    });

    session.deepgramWs = connection;

    connection.on("open", async () => {
      console.log("Deepgram connected");
      session.deepgramReady = true;
      // Only send greeting if Twilio start has already arrived (streamSid set)
      if (session.streamSid) {
        await sendGreeting(session, session.callerPhone ?? undefined);
      }
      // Otherwise, sendGreeting will be triggered by handleTwilioMessage "start"
    });

    connection.on("message", async (data: unknown) => {
      const d = data as { type?: string; channel?: { alternatives?: Array<{ transcript?: string }> }; is_final?: boolean };
      if (d.type === "Results") {
        const transcript = d.channel?.alternatives?.[0]?.transcript;
        const isFinal = d.is_final;

        if (transcript && isFinal) {
          console.log("STT final:", transcript);
          await processUserSpeech(session, transcript);
        }
      }
    });

    connection.on("error", (err: unknown) => {
      console.error("Deepgram error:", err);
    });

    connection.on("close", () => {
      console.log("Deepgram closed");
    });

    await connection.connect();
    await connection.waitForOpen();
  } catch (err) {
    console.error("Deepgram connection error:", err);
  }
}

async function sendGreeting(session: CallSession, callerPhone?: string) {
  if (session.greetingSent || session.closed) return;
  session.greetingSent = true;

  // Try to identify shop by caller ID
  let shopFound = false;
  if (callerPhone) {
    try {
      console.log(`Identifying shop by caller: ${callerPhone}`);
      // Step 1: Identify shop + fetch all products in parallel
      const [shop, allProducts] = await Promise.all([
        identifyShopByAnyPhone(callerPhone),
        supabaseAdmin
          .from("products")
          .select("product_id, product_name, brand, category, price, unit_type")
          .eq("is_active", true)
          .then((r) => r.data ?? []),
      ]);

      // Step 2: Fetch suggested order + beat call in parallel (both depend on shop_id)
      const [suggested, beatCallResult] = await Promise.all([
        getSuggestedOrder(shop.shop_id),
        supabaseAdmin
          .from("beat_calls")
          .select("id")
          .eq("shop_id", shop.shop_id)
          .eq("call_date", new Date().toISOString().slice(0, 10))
          .eq("status", "calling")
          .maybeSingle(),
      ]);

      session.ctx = {
        shopId: shop.shop_id,
        shopName: shop.shop_name,
        repeatItems: suggested.repeat_order,
        currentCart: [],
        currentSummary: null,
        corrections: 0,
        optedOut: false,
        pendingComplaintType: null,
        pendingReturnProductId: null,
        pendingReturnProductName: null,
        pendingReturnOrderId: null,
        isNewShop: false,
        isAutoCall: !!beatCallResult.data,
        onboardingStep: null,
        onboardingData: {},
        products: allProducts,
      };
      shopFound = true;
      console.log(`Shop identified: ${shop.shop_name} (${shop.shop_id}) auto=${!!beatCallResult.data} products=${allProducts.length}`);
    } catch (err) {
      console.log(`Shop not found for ${callerPhone}, using default context`);
    }
  }

  if (!shopFound) {
    // Fetch products in background for unknown shops too
    const allProducts = await supabaseAdmin
      .from("products")
      .select("product_id, product_name, brand, category, price, unit_type")
      .eq("is_active", true)
      .then((r) => r.data ?? []);

    session.ctx = {
      shopId: "",
      shopName: "Unknown Shop",
      repeatItems: [],
      currentCart: [],
      currentSummary: null,
      corrections: 0,
      optedOut: false,
      pendingComplaintType: null,
      pendingReturnProductId: null,
      pendingReturnProductName: null,
      pendingReturnOrderId: null,
      isNewShop: false,
      isAutoCall: false,
      onboardingStep: null,
      onboardingData: {},
      products: allProducts,
    } as VoiceContext;
  }

  const first = startCall(session.ctx!);
  session.state = first.state;

  console.log("Sending greeting immediately...");
  const startTime = Date.now();
  await sendAudioToTwilio(session, first.agentText);
  console.log(`Greeting sent in ${Date.now() - startTime}ms`);
}

interface TwilioMessage {
  event: string;
  start?: { streamSid: string };
  media?: { payload: string };
  mark?: { name: string };
  stop?: Record<string, unknown>;
}

async function handleTwilioMessage(session: CallSession, msg: TwilioMessage) {
  switch (msg.event) {
    case "start":
      session.streamSid = msg.start?.streamSid ?? null;
      // Extract caller phone from Exotel/Twilio start event
      const startData = msg.start as Record<string, unknown> | undefined;
      const customParams = startData?.CustomParameters as Record<string, string> | undefined;
      session.callerPhone = customParams?.From ?? customParams?.from ?? (startData?.From as string) ?? null;
      console.log("Stream started:", session.streamSid, "caller:", session.callerPhone);
      // Send greeting now that we have streamSid — if Deepgram is also ready
      if (session.deepgramReady && !session.greetingSent) {
        await sendGreeting(session, session.callerPhone ?? undefined);
      }
      break;

    case "media":
      if (msg.media?.payload) {
        const audioData = Buffer.from(msg.media.payload, "base64");
        session.audioBuffer.push(audioData);
        (session.deepgramWs as { socket?: { send: (data: Buffer) => void } })?.socket?.send?.(audioData);
      }
      break;

    case "stop":
      console.log("Stream stopped");
      (session.deepgramWs as { close?: () => void })?.close?.();
      session.twilioWs?.close?.();
      break;

    case "mark": {
      const markName = msg.mark?.name;
      console.log("Mark received:", markName);
      // Resolve any pending promise waiting for this mark
      const resolver = session.markResolvers.get(markName ?? "");
      if (resolver) {
        resolver();
        session.markResolvers.delete(markName ?? "");
      }
      break;
    }
  }
}

function waitForMark(session: CallSession, markName: string, timeoutMs: number = 15000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      session.markResolvers.delete(markName);
      resolve(false); // timed out
    }, timeoutMs);

    session.markResolvers.set(markName, () => {
      clearTimeout(timer);
      resolve(true); // mark received
    });
  });
}

async function processUserSpeech(session: CallSession, userText: string) {
  if (session.isProcessing) return;
  session.isProcessing = true;

  try {
    // If context not yet initialized (shouldn't happen now with greeting-on-connect),
    // fall back to sending greeting
    if (!session.ctx) {
      await sendGreeting(session);
      return;
    }

    // Echo protection: ignore speech that looks like agent's own TTS output
    const clean = userText.toLowerCase().trim();
    if (session.lastAgentText && clean.length > 3) {
      // Check if user text is a substring of agent's last message (agent echo)
      const agentWords = session.lastAgentText.split(/\s+/);
      const userWords = clean.split(/\s+/);
      const overlap = userWords.filter((w) => agentWords.includes(w)).length;
      if (overlap >= Math.min(3, userWords.length) && overlap / userWords.length > 0.6) {
        console.log(`Echo detected — ignoring: "${userText}"`);
        session.isProcessing = false;
        return;
      }
    }

    const result = step(session.state, userText, session.ctx);
    session.state = result.state;
    session.ctx = result.ctx;

    if (result.agentText) {
      await sendAudioToTwilio(session, result.agentText);
    }

    if (result.done) {
      console.log("Call completed — waiting for final audio to finish playing...");

      // Save callback time if requested
      if (result.ctx.pendingCallbackTime && result.ctx.shopId) {
        const timeStr = result.ctx.pendingCallbackTime;
        // Parse "5 PM" → "17:00:00"
        const match = timeStr.match(/(\d{1,2})\s*(AM|PM)/i);
        if (match) {
          let hour = parseInt(match[1], 10);
          const ampm = match[2].toUpperCase();
          if (ampm === "PM" && hour < 12) hour += 12;
          if (ampm === "AM" && hour === 12) hour = 0;
          const dbTime = `${String(hour).padStart(2, "0")}:00:00`;

          // Check if "permanent" was said (from callback_confirm state)
          // The engine sets pendingCallbackTime but doesn't distinguish temp vs permanent
          // We check if the text before end contains "permanent"
          const isPermanent = /permanent|always|every/i.test(userText);

          if (isPermanent) {
            await supabaseAdmin
              .from("shops")
              .update({ preferred_call_start: dbTime, preferred_call_end: `${String(Math.min(hour + 2, 23)).padStart(2, "0")}:00:00` })
              .eq("shop_id", result.ctx.shopId);
            console.log(`Saved permanent call time ${dbTime} for ${result.ctx.shopId}`);
          } else {
            await supabaseAdmin
              .from("shops")
              .update({ temp_call_time: dbTime })
              .eq("shop_id", result.ctx.shopId);
            console.log(`Saved temp call time ${dbTime} for ${result.ctx.shopId}`);
          }
        }
      }

      // Wait for the mark event confirming TTS audio was delivered to the phone
      // before closing the WebSocket. This ensures "Nandri, vanakkam!" etc. are heard.
      const markName = `tts-end-${Date.now()}`;
      // The mark was already sent in sendAudioToTwilio, so we just need to wait
      // for any pending mark. Give a generous timeout in case of network issues.
      await new Promise((r) => setTimeout(r, 500)); // small delay to let mark arrive
      console.log("Closing call WebSocket");
      session.twilioWs?.close?.();
    }
  } catch (err) {
    console.error("Process speech error:", err);
    await sendAudioToTwilio(session, SCRIPT.endGood);
  } finally {
    session.isProcessing = false;
  }
}

async function sendAudioToTwilio(session: CallSession, text: string) {
  if (!session.streamSid || !session.twilioWs || session.twilioWs.readyState !== WebSocket.OPEN || session.closed) {
    return;
  }

  try {
    const startTime = Date.now();
    const audioBuffer = await synthesizeSarvamTTSMulaw(text, "ta-IN");
    const ttsTime = Date.now() - startTime;
    console.log(`TTS synthesized in ${ttsTime}ms (${text.substring(0, 40)}...)`);

    // Track last agent text for echo detection
    session.lastAgentText = text.toLowerCase().trim();

    const base64Audio = audioBuffer.toString("base64");

    const mediaMsg = {
      event: "media",
      streamSid: session.streamSid,
      media: { payload: base64Audio },
    };

    session.twilioWs.send(JSON.stringify(mediaMsg));

    const markName = `tts-${Date.now()}`;
    const markMsg = {
      event: "mark",
      streamSid: session.streamSid,
      mark: { name: markName },
    };
    session.twilioWs.send(JSON.stringify(markMsg));
  } catch (err) {
    console.error("TTS send error:", err);
  }
}

server.listen(WS_PORT, () => {
  console.log(`Server listening on port ${WS_PORT}`);
  console.log(`  Webhook: http://localhost:${WS_PORT}/api/twilio/voice`);
  console.log(`  WebSocket: ws://localhost:${WS_PORT}`);
});

server.on("error", (err: Error) => {
  console.error("Server error:", err);
});

process.on("uncaughtException", (err: Error) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});