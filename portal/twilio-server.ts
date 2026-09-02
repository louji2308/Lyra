import { DeepgramClient } from "@deepgram/sdk";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { step, startCall } from "./src/lib/voice/engine";
import { SCRIPT } from "./src/lib/voice/script";
import type { VoiceContext, VoiceState } from "./src/lib/voice/types";
import { synthesizeSarvamTTSMulaw } from "./src/lib/voice/sarvam";

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
if (!deepgramApiKey) {
  throw new Error("DEEPGRAM_API_KEY not set");
}

const deepgram = new DeepgramClient({ apiKey: deepgramApiKey });

interface CallSession {
  state: VoiceState;
  ctx: VoiceContext | null;
  streamSid: string | null;
  twilioWs: WebSocket;
  deepgramWs: unknown;
  audioBuffer: Buffer[];
  isProcessing: boolean;
  greetingSent: boolean;
  markResolvers: Map<string, () => void>;
  closed: boolean;
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
    twilioWs: ws,
    deepgramWs: null,
    audioBuffer: [],
    isProcessing: false,
    greetingSent: false,
    markResolvers: new Map(),
    closed: false,
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
      // Send greeting immediately — don't wait for user to speak first
      await sendGreeting(session);
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

async function sendGreeting(session: CallSession) {
  if (session.greetingSent || session.closed) return;
  session.greetingSent = true;

  // Initialize context and generate greeting
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
    onboardingStep: null,
    onboardingData: {},
  } as VoiceContext;

  const first = startCall(session.ctx);
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
      console.log("Stream started:", session.streamSid);
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

    const result = step(session.state, userText, session.ctx);
    session.state = result.state;
    session.ctx = result.ctx;

    if (result.agentText) {
      await sendAudioToTwilio(session, result.agentText);
    }

    if (result.done) {
      console.log("Call completed — waiting for final audio to finish playing...");
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