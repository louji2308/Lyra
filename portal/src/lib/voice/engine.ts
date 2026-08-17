import { detectIntent } from "./intents";
import { SCRIPT } from "./script";
import type { RepeatItem, VoiceContext, VoiceState, VoiceStep } from "./types";

export function summarize(items: RepeatItem[]): string | null {
  if (!items || items.length === 0) return null;
  return items
    .map((i) => `${i.quantity} ${i.unit} ${i.product_name}`)
    .join(", ");
}

export function startCall(ctx: VoiceContext): VoiceStep {
  return {
    state: "greeting",
    agentText: SCRIPT.greet(ctx.shopName),
    done: false,
    ctx,
  };
}

function endWith(
  state: VoiceState,
  agentText: string,
  ctx: VoiceContext,
  extra: Partial<VoiceContext> = {}
): VoiceStep {
  return {
    state: "end",
    agentText,
    done: true,
    ctx: { ...ctx, ...extra },
  };
}

export function step(
  state: VoiceState,
  userText: string,
  ctx: VoiceContext
): VoiceStep {
  const intent = detectIntent(userText);

  // Global pre-checks: intents that apply in any conversational state
  if (intent === "stop") {
    return endWith(state, SCRIPT.endOptOut, ctx, { optedOut: true });
  }
  const inSubFlow =
    state === "complaint" ||
    state === "complaint_desc" ||
    state === "return_product" ||
    state === "return_qty" ||
    state === "return_reason";
  if (!inSubFlow) {
    if (intent === "complaint") {
      return { state: "complaint", agentText: SCRIPT.complaintAsk, done: false, ctx };
    }
    if (intent === "return") {
      return { state: "return_product", agentText: SCRIPT.returnAsk, done: false, ctx };
    }
  }

  switch (state) {
    case "greeting": {
      if (intent === "yes") {
        return {
          state: "good_time",
          agentText: SCRIPT.goodTime,
          done: false,
          ctx,
        };
      }
      return endWith(state, SCRIPT.endWrongNumber, ctx);
    }

    case "good_time": {
      if (intent === "yes") {
        const summary = summarize(ctx.repeatItems);
        return {
          state: summary ? "repeat_order" : "changes",
          agentText: summary ? SCRIPT.repeatOrder(summary) : SCRIPT.whatDoYouNeed,
          done: false,
          ctx: { ...ctx, currentSummary: summary },
        };
      }
      return endWith(state, SCRIPT.endNotGoodTime, ctx);
    }

    case "repeat_order": {
      if (intent === "yes") {
        return {
          state: "read_back",
          agentText: SCRIPT.readBack(ctx.currentSummary ?? ""),
          done: false,
          ctx,
        };
      }
      return {
        state: "changes",
        agentText: SCRIPT.changes,
        done: false,
        ctx,
      };
    }

    case "changes": {
      const corrected = userText.trim() || ctx.currentSummary || "no changes";
      return {
        state: "read_back",
        agentText: SCRIPT.readBack(corrected),
        done: false,
        ctx: { ...ctx, currentSummary: corrected, corrections: ctx.corrections + 1 },
      };
    }

    case "read_back": {
      if (intent === "yes") {
        return {
          state: "confirm",
          agentText: SCRIPT.confirm,
          done: false,
          ctx,
        };
      }
      if (ctx.corrections >= 1) {
        return endWith(state, SCRIPT.endNoConfirm, ctx);
      }
      return { state: "changes", agentText: SCRIPT.changes, done: false, ctx };
    }

    case "confirm": {
      return endWith(state, SCRIPT.endGood, ctx);
    }

    case "complaint": {
      const complaintType = userText.trim() || "other";
      return {
        state: "complaint_desc",
        agentText: SCRIPT.complaintConfirm(complaintType),
        done: false,
        ctx: { ...ctx, pendingComplaintType: complaintType },
      };
    }

    case "complaint_desc": {
      if (intent === "yes") {
        return endWith(state, SCRIPT.complaintEscalate, ctx);
      }
      return endWith(state, SCRIPT.endGood, ctx);
    }

    case "return_product": {
      const productName = userText.trim();
      return {
        state: "return_qty",
        agentText: SCRIPT.returnQty(productName || "that product"),
        done: false,
        ctx: { ...ctx, pendingReturnProductName: productName || null },
      };
    }

    case "return_qty": {
      const qty = parseInt(userText.trim(), 10);
      if (!Number.isFinite(qty) || qty <= 0) {
        return {
          state: "return_qty",
          agentText: "Ethu quantity? Number sollunga.",
          done: false,
          ctx,
        };
      }
      return {
        state: "return_reason",
        agentText: SCRIPT.returnAskReason(
          ctx.pendingReturnProductName ?? "product",
          qty
        ),
        done: false,
        ctx: { ...ctx, pendingReturnProductName: ctx.pendingReturnProductName ?? "product" },
      };
    }

    case "return_reason": {
      return endWith(
        state,
        SCRIPT.returnConfirm(
          ctx.pendingReturnProductName ?? "product",
          parseInt(userText.trim(), 10) || 1
        ),
        ctx
      );
    }

    case "end":
    default:
      return { state: "end", agentText: "", done: true, ctx };
  }
}

export const STATE_LABELS: Record<VoiceState, string> = {
  greeting: "Greeting",
  good_time: "Good time?",
  repeat_order: "Suggest repeat",
  changes: "Taking changes",
  read_back: "Read back",
  confirm: "Confirming",
  complaint: "Complaint type",
  complaint_desc: "Complaint details",
  return_product: "Return product",
  return_qty: "Return quantity",
  return_reason: "Return reason",
  end: "Ended",
};
