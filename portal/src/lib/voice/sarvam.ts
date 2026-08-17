export interface SarvamTTSOptions {
  text: string;
  languageCode?: string;
  speaker?: string;
  model?: "bulbul:v2" | "bulbul:v3";
  outputAudioCodec?: "mulaw" | "wav" | "mp3" | "linear16" | "alaw" | "opus" | "flac" | "aac";
  speechSampleRate?: 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000;
  pace?: number;
  temperature?: number;
}

export interface SarvamTTSResponse {
  request_id: string;
  audios: string[];
}

const SARVAM_API_URL = "https://api.sarvam.ai/text-to-speech";

export async function synthesizeSarvamTTS(
  options: SarvamTTSOptions
): Promise<Buffer> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error("SARVAM_API_KEY not set");
  }

  const payload = {
    text: options.text,
    language_code: options.languageCode ?? "ta-IN",
    speaker: options.speaker ?? "shubh",
    model: options.model ?? "bulbul:v3",
    output_audio_codec: options.outputAudioCodec ?? "mulaw",
    speech_sample_rate: options.speechSampleRate ?? 8000,
    pace: options.pace ?? 1.0,
    temperature: options.temperature ?? 0.6,
  };

  const res = await fetch(SARVAM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sarvam TTS error: ${res.status} ${JSON.stringify(err)}`);
  }

  const data = (await res.json()) as SarvamTTSResponse;
  const base64Audio = data.audios?.[0];
  if (!base64Audio) {
    throw new Error("No audio returned from Sarvam TTS");
  }

  return Buffer.from(base64Audio, "base64");
}

export async function synthesizeSarvamTTSMulaw(
  text: string,
  languageCode: string = "ta-IN"
): Promise<Buffer> {
  return synthesizeSarvamTTS({
    text,
    languageCode,
    outputAudioCodec: "mulaw",
    speechSampleRate: 8000,
  });
}