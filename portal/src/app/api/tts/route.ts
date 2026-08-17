import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EdgeTTS } from "node-edge-tts";
import { bhashiniEnabled, bhashiniTts } from "@/lib/voice/bhashini";

export const runtime = "nodejs";

const OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3";

export const LYRA_VOICES = {
  male: { voice: "ta-IN-ValluvarNeural", label: "Male · ta-IN" },
  female: { voice: "ta-IN-PallaviNeural", label: "Female · ta-IN" },
} as const;

function sanitize(text: string): string {
  const cleaned = text.replace(/[<>]/g, "").trim().slice(0, 2000);
  if (!cleaned) throw new Error("empty-text");
  return cleaned;
}

async function synthesizeEdge(text: string, voice: string): Promise<Response> {
  const dir = mkdtempSync(join(tmpdir(), "lyra-tts-"));
  const file = join(dir, "speech.mp3");

  try {
    const tts = new EdgeTTS({
      voice,
      lang: "ta-IN",
      outputFormat: OUTPUT_FORMAT,
      rate: "-5%",
      pitch: "+0Hz",
      timeout: 20000,
    });
    await tts.ttsPromise(text, file);
    const audio = readFileSync(file);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch (err) {
    console.error("[lyra-tts] edge synthesis failed:", err);
    return Response.json(
      { error: "synthesis-failed", detail: String(err) },
      { status: 502 }
    );
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
}

export async function POST(request: Request) {
  let body: { text?: string; voice?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }

  let text: string;
  try {
    text = sanitize(body.text ?? "");
  } catch {
    return Response.json({ error: "empty-text" }, { status: 400 });
  }

  const voice = body.voice === "female" ? "female" : "male";
  const edgeVoice = LYRA_VOICES[voice].voice;

  if (bhashiniEnabled()) {
    try {
      const audio = await bhashiniTts(text, voice);
      const wav = new Uint8Array(audio);
      return new Response(wav, {
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(wav.byteLength),
          "Cache-Control": "private, max-age=0",
        },
      });
    } catch (err) {
      console.error("[lyra-tts] bhashini failed, falling back to edge:", err);
    }
  }

  return synthesizeEdge(text, edgeVoice);
}

export async function GET() {
  return Response.json({
    voices: Object.fromEntries(
      Object.entries(LYRA_VOICES).map(([key, v]) => [key, v.voice])
    ),
    engine: bhashiniEnabled()
      ? "AI4Bharat IndicTTS (ta-IN, via Bhashini ULCA)"
      : "Microsoft Edge TTS (ta-IN neural, free)",
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
