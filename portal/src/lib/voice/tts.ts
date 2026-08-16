"use client";

export type LyraVoice = "male" | "female";

let audio: HTMLAudioElement | null = null;
let fallbackVoice: SpeechSynthesisVoice | null = null;

function getFallbackVoice(): SpeechSynthesisVoice | null {
  if (fallbackVoice) return fallbackVoice;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  fallbackVoice =
    voices.find((v) => v.lang.toLowerCase().startsWith("ta")) ||
    voices.find((v) => v.lang.toLowerCase() === "en-in") ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
    null;
  return fallbackVoice;
}

function speakFallback(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getFallbackVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

async function playBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  if (!audio) {
    audio = new Audio();
  }
  audio.src = url;
  await audio.play();
}

export async function speakLyra(
  text: string,
  voice: LyraVoice = "male"
): Promise<boolean> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const blob = await res.blob();
    if (!blob.size) throw new Error("empty audio");
    await playBlob(blob);
    return true;
  } catch {
    speakFallback(text);
    return false;
  }
}

export function stopLyraSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}
