import { DeepgramClient } from "@deepgram/sdk";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
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
}

const server = createServer();
const wss = new WebSocketServer({ server });

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

    connection.on("open", () => {
      console.log("Deepgram connected");
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

    case "mark":
      console.log("Mark:", msg.mark?.name);
      break;
  }
}

async function processUserSpeech(session: CallSession, userText: string) {
  if (session.isProcessing) return;
  session.isProcessing = true;

  try {
    if (!session.ctx) {
      session.ctx = {
        shopId: "",
        shopName: "Unknown Shop",
        repeatItems: [],
        currentSummary: null,
        corrections: 0,
        optedOut: false,
        pendingComplaintType: null,
        pendingReturnProductId: null,
        pendingReturnProductName: null,
        pendingReturnOrderId: null,
      } as VoiceContext;
      const first = startCall(session.ctx);
      session.state = first.state;
      await sendAudioToTwilio(session, first.agentText);
      return;
    }

    const result = step(session.state, userText, session.ctx);
    session.state = result.state;
    session.ctx = result.ctx;

    if (result.agentText) {
      await sendAudioToTwilio(session, result.agentText);
    }

    if (result.done) {
      console.log("Call completed");
      await new Promise((r) => setTimeout(r, 1000));
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
  if (!session.streamSid || !session.twilioWs || session.twilioWs.readyState !== WebSocket.OPEN) {
    return;
  }

  try {
    const audioBuffer = await synthesizeSarvamTTSMulaw(text, "ta-IN");
    const base64Audio = audioBuffer.toString("base64");

    const mediaMsg = {
      event: "media",
      streamSid: session.streamSid,
      media: { payload: base64Audio },
    };

    session.twilioWs.send(JSON.stringify(mediaMsg));

    const markMsg = {
      event: "mark",
      streamSid: session.streamSid,
      mark: { name: `tts-${Date.now()}` },
    };
    session.twilioWs.send(JSON.stringify(markMsg));
  } catch (err) {
    console.error("TTS send error:", err);
  }
}

server.listen(3001, () => {
  console.log("WebSocket server listening on port 3001");
});