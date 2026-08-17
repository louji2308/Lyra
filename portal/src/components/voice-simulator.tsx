"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Card, CardHeader } from "@/components/ui";
import { languageLabel } from "@/lib/format";
import { STATE_LABELS, startCall, step, summarize } from "@/lib/voice/engine";
import { LYRA_SYSTEM_PROMPT } from "@/lib/voice/prompt";
import { VOICE_TOOLS } from "@/lib/voice/tools";
import { speakLyra, stopLyraSpeech, type LyraVoice } from "@/lib/voice/tts";
import { voiceApi, type CreatedOrderPayload } from "@/lib/voice/client";
import type { AppLanguage } from "@/lib/types";
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
  phone_number: string;
};

type TraceEvent = {
  id: number;
  tool: string;
  detail: string;
  status: "ok" | "error";
  at: string;
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
  "complaint",
  "return_product",
  "end",
];

export function VoiceSimulator({ shops }: { shops: ShopOption[] }) {
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
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [orderResult, setOrderResult] = useState<CreatedOrderPayload | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [callLanguage, setCallLanguage] = useState<AppLanguage>("tanglish");

  const phaseRef = useRef(phase);
  const stateRef = useRef(state);
  const ctxRef = useRef(ctx);
  const ttsRef = useRef(ttsOn);
  const voiceRef = useRef(voice);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
    stateRef.current = state;
    ctxRef.current = ctx;
    ttsRef.current = ttsOn;
    voiceRef.current = voice;
  });

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

  const pushTrace = useCallback(
    (tool: string, detail: string, status: "ok" | "error" = "ok") => {
      setTrace((t) => [
        ...t,
        {
          id: t.length + 1,
          tool,
          detail,
          status,
          at: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      ]);
    },
    []
  );

  const recordOptOut = useCallback(
    async (ctxFinal: VoiceContext) => {
      try {
        pushTrace("mark_opt_out", `shop_id=${ctxFinal.shopId}`);
        const res = await voiceApi.markOptOut(ctxFinal.shopId);
        pushTrace("mark_opt_out", `${res.shop_name}: opt_out=true, voice_consent=false`);
      } catch (err) {
        pushTrace(
          "mark_opt_out",
          err instanceof Error ? err.message : String(err),
          "error"
        );
      }
    },
    [pushTrace]
  );

  const placeOrder = useCallback(
    async (ctxFinal: VoiceContext) => {
      const items = ctxFinal.repeatItems.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
      }));
      const summary = ctxFinal.currentSummary ?? summarize(ctxFinal.repeatItems) ?? "";
      try {
        pushTrace("create_order", `shop_id=${ctxFinal.shopId} · ${items.length} item(s)`);
        const order = await voiceApi.createOrder({
          shop_id: ctxFinal.shopId,
          items,
          transcript_summary: summary,
          language_detected: callLanguage,
        });
        setOrderResult(order);
        pushTrace(
          "create_order",
          `${order.order_id} created · ₹${order.total_amount.toLocaleString("en-IN")} · ${order.order_status}`
        );
        pushTrace("save_memory", "order behaviour → product_preference");
        await voiceApi.saveMemory({
          shop_id: ctxFinal.shopId,
          memory_text: `Repeat order confirmed: ${summary}`,
          memory_type: "product_preference",
          confirmed_by_user: true,
          confidence_score: 0.9,
        });
        pushTrace("save_memory", "memory saved");
      } catch (err) {
        pushTrace(
          "create_order",
          err instanceof Error ? err.message : String(err),
          "error"
        );
        setApiError(err instanceof Error ? err.message : String(err));
      }
    },
    [pushTrace, callLanguage]
  );

  const hydrateState = useCallback((nextState: VoiceState, nextCtx: VoiceContext) => {
    stateRef.current = nextState;
    ctxRef.current = nextCtx;
    setState(nextState);
    setCtx(nextCtx);
  }, []);

  const runStep = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || phaseRef.current !== "active" || !ctxRef.current) return;
      const prevState = stateRef.current;
      setInput("");
      setMessages((m) => [...m, { role: "user", text: trimmed }]);
      const result = step(prevState, trimmed, ctxRef.current);
      hydrateState(result.state, result.ctx);
      if (result.agentText) {
        setMessages((m) => [...m, { role: "agent", text: result.agentText }]);
        speak(result.agentText);
      }
      if (result.done) {
        phaseRef.current = "done";
        setPhase("done");
        if (result.ctx.optedOut) {
          void recordOptOut(result.ctx);
        } else if (prevState === "confirm") {
          void placeOrder(result.ctx);
        }
      }
    },
    [hydrateState, speak, recordOptOut, placeOrder]
  );

  const resetCallState = useCallback(() => {
    setMessages([]);
    setTrace([]);
    setOrderResult(null);
    setApiError(null);
    setCtx(null);
    setState("greeting");
  }, []);

  const handleStart = async () => {
    if (!selectedShopId) return;
    const shop = shops.find((s) => s.shop_id === selectedShopId);
    if (!shop) return;
    stopLyraSpeech();
    stopRecognition();
    resetCallState();
    setPhase("active");
    try {
      pushTrace("identify_shop_by_phone", `phone=${shop.phone_number}`);
      const context = await voiceApi.identifyShopByPhone(shop.phone_number);
      setCallLanguage(context.language);
      pushTrace(
        "identify_shop_by_phone",
        `${context.shop_name} found · ${context.language} · credit ₹${context.available_credit.toLocaleString("en-IN")}`
      );

      pushTrace("get_suggested_order", `shop_id=${shop.shop_id}`);
      const suggested = await voiceApi.getSuggestedOrder(shop.shop_id);
      const repeat: RepeatItem[] = suggested.repeat_order;
      pushTrace(
        "get_suggested_order",
        repeat.length
          ? `${repeat.length} item(s) from last order`
          : "no prior order — start from scratch"
      );

      const ctx0: VoiceContext = {
        shopId: context.shop_id,
        shopName: context.shop_name,
        repeatItems: repeat,
        currentSummary: null,
        corrections: 0,
        optedOut: false,
        pendingComplaintType: null,
        pendingReturnProductId: null,
        pendingReturnProductName: null,
        pendingReturnOrderId: null,
      };
      const first = startCall(ctx0);
      hydrateState(first.state, first.ctx);
      setMessages([{ role: "agent", text: first.agentText }]);
      phaseRef.current = "active";
      setPhase("active");
      speak(first.agentText);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      pushTrace("identify_shop_by_phone", message, "error");
      setApiError(message);
      setPhase("idle");
    }
  };

  const handleLiveCall = async () => {
    if (!selectedShopId) return;
    const shop = shops.find((s) => s.shop_id === selectedShopId);
    if (!shop) return;
    stopLyraSpeech();
    stopRecognition();
    resetCallState();
    setPhase("active");
    pushTrace("live_call", `Initiating live call to ${shop.shop_name} (${shop.phone_number})`);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shop.shop_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Call failed");
      pushTrace("live_call", `Call initiated: ${data.call_sid} to ${data.to}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      pushTrace("live_call", message, "error");
      setApiError(message);
      setPhase("idle");
    }
  };

  const handleEnd = () => {
    stopLyraSpeech();
    stopRecognition();
    recRef.current = null;
    resetCallState();
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
          subtitle="Incoming call → real Supabase lookup → order saved back to the database"
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
          {apiError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <span className="font-semibold">Database lookup failed:</span> {apiError}
            </div>
          )}

          {orderResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <span className="font-semibold">Order saved to database</span> —{" "}
              <span className="font-mono font-semibold">{orderResult.order_id}</span> · ₹
              {orderResult.total_amount.toLocaleString("en-IN")} · {orderResult.order_status}
              <a
                href="/orders"
                className="ml-2 font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
              >
                View in portal →
              </a>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-zinc-500" htmlFor="voice-shop">
              Incoming call
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
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-xs font-medium text-zinc-600">
                {selectedShop.phone_number}
              </span>
            )}
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
              <>
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Start call (simulator)
                </button>
                <button
                  type="button"
                  onClick={() => void handleLiveCall()}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                >
                  Live call (phone)
                </button>
              </>
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
                  <option value="male">Male · ta-IN</option>
                  <option value="female">Female · ta-IN</option>
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
                Press <span className="font-medium">Start call</span> to begin. Lyra
                identifies the shop by Caller ID, greets in their language, suggests the
                repeat order and saves the confirmed order back to the database.
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
              Shop owner opted out — <span className="font-semibold">mark_opt_out</span>{" "}
              recorded in the database (voice_consent=false).
            </p>
          )}
        </div>
      </Card>

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader
            title="Database trace"
            subtitle="Live API calls made by this call"
          />
          {trace.length === 0 ? (
            <p className="p-4 text-sm text-zinc-400">
              Start a call to see the agent hit the real Supabase API.
            </p>
          ) : (
            <ol className="space-y-2 p-4">
              {trace.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        t.status === "ok" ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    <span className="font-mono text-xs font-semibold text-zinc-800">
                      {t.tool}
                    </span>
                    <span className="ml-auto text-[10px] text-zinc-400">{t.at}</span>
                  </div>
                  <p className="mt-0.5 pl-3 text-xs text-zinc-600">{t.detail}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>

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
            title="Tools"
            subtitle="Function schemas the agent calls — implemented against live Supabase"
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
