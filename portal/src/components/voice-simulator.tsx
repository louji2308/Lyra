"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Card, CardHeader } from "@/components/ui";
import { languageLabel } from "@/lib/format";
import { STATE_LABELS, startCall, step } from "@/lib/voice/engine";
import { LYRA_SYSTEM_PROMPT } from "@/lib/voice/prompt";
import { VOICE_TOOLS } from "@/lib/voice/tools";
import { speakLyra, stopLyraSpeech, type LyraVoice } from "@/lib/voice/tts";
import type {
  RepeatItem,
  VoiceContext,
  VoiceMessage,
  VoiceState,
} from "@/lib/voice/types";

type ShopOption = {
  shop_id: string;
  shop_name: string;
  preferred_language: string;
};

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const FLOW_STEPS: VoiceState[] = [
  "greeting",
  "good_time",
  "repeat_order",
  "changes",
  "read_back",
  "confirm",
  "end",
];

export function VoiceSimulator({
  shops,
  repeatByShop,
}: {
  shops: ShopOption[];
  repeatByShop: Record<string, RepeatItem[]>;
}) {
  const [phase, setPhase] = useState<"idle" | "active" | "done">("idle");
  const [selectedShopId, setSelectedShopId] = useState(shops[0]?.shop_id ?? "");
  const [state, setState] = useState<VoiceState>("greeting");
  const [ctx, setCtx] = useState<VoiceContext | null>(null);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [input, setInput] = useState("");
  const [ttsOn, setTtsOn] = useState(true);
  const [voice, setVoice] = useState<LyraVoice>("male");
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState<"prompt" | "tools" | null>(null);

  const phaseRef = useRef(phase);
  const stateRef = useRef(state);
  const ctxRef = useRef(ctx);
  const ttsRef = useRef(ttsOn);
  const voiceRef = useRef(voice);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);
  useEffect(() => {
    ttsRef.current = ttsOn;
  }, [ttsOn]);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  const speechSupported = useSyncExternalStore(
    () => () => {},
    () =>
      typeof window !== "undefined" &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    () => false
  );

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const speak = useCallback((text: string) => {
    if (!ttsRef.current || typeof window === "undefined") return;
    void speakLyra(text, voiceRef.current);
  }, []);

  const runStep = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || phaseRef.current !== "active" || !ctxRef.current) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", text: trimmed }]);
      const result = step(stateRef.current, trimmed, ctxRef.current);
      stateRef.current = result.state;
      ctxRef.current = result.ctx;
      setState(result.state);
      setCtx(result.ctx);
      if (result.agentText) {
        setMessages((m) => [...m, { role: "agent", text: result.agentText }]);
        speak(result.agentText);
      }
      if (result.done) {
        phaseRef.current = "done";
        setPhase("done");
      }
    },
    [speak]
  );

  const handleStart = () => {
    if (!selectedShopId) return;
    const shop = shops.find((s) => s.shop_id === selectedShopId);
    if (!shop) return;
    const ctx0: VoiceContext = {
      shopId: shop.shop_id,
      shopName: shop.shop_name,
      repeatItems: repeatByShop[shop.shop_id] ?? [],
      currentSummary: null,
      corrections: 0,
      optedOut: false,
    };
    const first = startCall(ctx0);
    ctxRef.current = first.ctx;
    stateRef.current = first.state;
    setCtx(first.ctx);
    setState(first.state);
    setMessages([{ role: "agent", text: first.agentText }]);
    phaseRef.current = "active";
    setPhase("active");
    speak(first.agentText);
  };

  const handleEnd = () => {
    stopLyraSpeech();
    stopRecognition();
    recRef.current = null;
    setMessages([]);
    setCtx(null);
    setState("greeting");
    setPhase("idle");
  };

  const startRecognition = () => {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "ta-IN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      runStep(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const stopRecognition = () => {
    recRef.current?.abort();
    recRef.current = null;
    setListening(false);
  };

  const copy = async (kind: "prompt" | "tools") => {
    const text =
      kind === "prompt" ? LYRA_SYSTEM_PROMPT : JSON.stringify(VOICE_TOOLS, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  const selectedShop = shops.find((s) => s.shop_id === selectedShopId);
  const activeStepIndex = FLOW_STEPS.indexOf(state);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader
          title="Live call"
          subtitle="The Lyra voice flow, running entirely in the browser (no phone line)"
          right={
            <div className="flex items-center gap-2">
              {phase === "active" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  On call
                </span>
              )}
              {state !== "end" && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {STATE_LABELS[state]}
                </span>
              )}
            </div>
          }
        />

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-zinc-500" htmlFor="voice-shop">
              Calling
            </label>
            <select
              id="voice-shop"
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              disabled={phase === "active"}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
            >
              {shops.map((s) => (
                <option key={s.shop_id} value={s.shop_id}>
                  {s.shop_name}
                </option>
              ))}
            </select>
            {selectedShop && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20">
                {languageLabel[selectedShop.preferred_language] ?? selectedShop.preferred_language}
              </span>
            )}
            {ctx && ctx.repeatItems.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                Last order: {ctx.repeatItems.length} item
                {ctx.repeatItems.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {phase === "idle" ? (
              <button
                type="button"
                onClick={handleStart}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                Start call
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnd}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
              >
                {phase === "done" ? "New call" : "End call"}
              </button>
            )}
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={ttsOn}
                onChange={(e) => setTtsOn(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
              />
              Speak responses
            </label>
            {ttsOn && (
              <label className="flex items-center gap-1.5 text-sm text-zinc-600">
                <span className="text-xs text-zinc-400">Voice</span>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value as LyraVoice)}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-900"
                >
                  <option value="male">Valluvar · Male (ta-IN)</option>
                  <option value="female">Pallavi · Female (ta-IN)</option>
                </select>
                <span className="text-[11px] text-zinc-400">Edge neural · free</span>
              </label>
            )}
          </div>

          <div
            ref={transcriptRef}
            className="h-72 space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-zinc-400">
                Press <span className="font-medium">Start call</span> to begin.
                Lyra will greet the shop and walk through the order flow.
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "agent" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      m.role === "agent"
                        ? "rounded-bl-sm bg-emerald-600 text-white"
                        : "rounded-br-sm bg-white text-zinc-900 ring-1 ring-inset ring-zinc-200"
                    }`}
                  >
                    {m.role === "agent" && (
                      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
                        Lyra
                      </span>
                    )}
                    {m.text}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            {speechSupported && (
              <button
                type="button"
                onClick={listening ? stopRecognition : startRecognition}
                disabled={phase !== "active"}
                aria-label="Speak instead of typing"
                className={`rounded-lg p-2.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
                  listening
                    ? "bg-rose-100 text-rose-700"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <path d="M12 19v3" />
                </svg>
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runStep(input);
              }}
              placeholder={
                phase === "active"
                  ? "Type your reply (e.g. haan, illa, add 1 box Clinic Plus)…"
                  : "Start a call first"
              }
              disabled={phase !== "active"}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none disabled:bg-zinc-100"
            />
            <button
              type="button"
              onClick={() => runStep(input)}
              disabled={phase !== "active"}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
            >
              Send
            </button>
          </div>

          {ctx?.optedOut && (
            <p className="text-xs text-amber-700">
              Shop owner opted out — the real agent would call <span className="font-semibold">mark_opt_out</span> and stop future calls.
            </p>
          )}
        </div>
      </Card>

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader
            title="Call flow"
            subtitle="The exact flow the live SnapServe agent will follow"
          />
          <ol className="space-y-1 p-4">
            {FLOW_STEPS.map((s, i) => (
              <li
                key={s}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                  i === activeStepIndex
                    ? "bg-emerald-50 font-semibold text-emerald-800"
                    : i < activeStepIndex
                      ? "text-zinc-400"
                      : "text-zinc-600"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    i < activeStepIndex
                      ? "bg-emerald-600 text-white"
                      : i === activeStepIndex
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {i < activeStepIndex ? "✓" : i + 1}
                </span>
                {STATE_LABELS[s]}
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardHeader
            title="System prompt"
            subtitle="Copy-paste into the SnapServe agent when the number is live"
            right={
              <button
                type="button"
                onClick={() => copy("prompt")}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                {copied === "prompt" ? "Copied" : "Copy"}
              </button>
            }
          />
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-zinc-700">
            {LYRA_SYSTEM_PROMPT}
          </pre>
        </Card>

        <Card>
          <CardHeader
            title="Tools (Phase 4)"
            subtitle="Function schemas the agent will call against Supabase"
            right={
              <button
                type="button"
                onClick={() => copy("tools")}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
              >
                {copied === "tools" ? "Copied" : "Copy"}
              </button>
            }
          />
          <pre className="max-h-64 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-zinc-700">
            {JSON.stringify(VOICE_TOOLS, null, 2)}
          </pre>
        </Card>
      </div>
    </div>
  );
}
