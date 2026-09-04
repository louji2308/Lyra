import { detectIntent } from "./intents";
import type { Intent } from "./intents";
import { SCRIPT } from "./script";
import type { RepeatItem, VoiceContext, VoiceState, VoiceStep, CartItem } from "./types";

export function summarize(items: RepeatItem[]): string | null {
  if (!items || items.length === 0) return null;
  return items
    .map((i) => `${i.quantity} ${i.unit} ${i.product_name}`)
    .join(", ");
}

export function summarizeCart(cart: CartItem[]): string | null {
  if (!cart || cart.length === 0) return null;
  return cart
    .map((i) => `${i.quantity} ${i.unit} ${i.product_name} @ ₹${i.price.toFixed(0)} = ₹${i.line_total.toFixed(0)}`)
    .join("; ");
}

function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.line_total, 0);
}

function findCartItem(cart: CartItem[], productId: string): CartItem | undefined {
  return cart.find((item) => item.product_id === productId);
}

function addToCart(cart: CartItem[], item: CartItem): CartItem[] {
  const existing = findCartItem(cart, item.product_id);
  if (existing) {
    return cart.map((c) =>
      c.product_id === item.product_id
        ? {
            ...c,
            quantity: c.quantity + item.quantity,
            line_total: (c.quantity + item.quantity) * c.price,
          }
        : c
    );
  }
  return [...cart, item];
}

function removeFromCart(cart: CartItem[], productId: string, quantity?: number): CartItem[] {
  const existing = findCartItem(cart, productId);
  if (!existing) return cart;
  const newQty = quantity ? existing.quantity - quantity : 0;
  if (newQty <= 0) {
    return cart.filter((c) => c.product_id !== productId);
  }
  return cart.map((c) =>
    c.product_id === productId ? { ...c, quantity: newQty, line_total: newQty * c.price } : c
  );
}

/**
 * Find a product by fuzzy name match against the products list.
 * Returns the best match or null if not found.
 */
function findProduct(
  products: VoiceContext["products"],
  query: string
): NonNullable<VoiceContext["products"]>[number] | null {
  if (!products || !query) return null;
  const q = query.toLowerCase().trim();

  // Exact match on product_name
  const exact = products.find((p) => p.product_name.toLowerCase() === q);
  if (exact) return exact;

  // Partial match — product_name contains query or vice versa
  const partial = products.find(
    (p) => p.product_name.toLowerCase().includes(q) || q.includes(p.product_name.toLowerCase())
  );
  if (partial) return partial;

  // Brand match — query matches brand name
  const brandMatch = products.find((p) => p.brand.toLowerCase().includes(q) || q.includes(p.brand.toLowerCase()));
  if (brandMatch) return brandMatch;

  // Fuzzy: remove spaces and compare
  const qClean = q.replace(/\s+/g, "");
  const fuzzy = products.find((p) => {
    const nameClean = p.product_name.toLowerCase().replace(/\s+/g, "");
    return nameClean.includes(qClean) || qClean.includes(nameClean);
  });
  if (fuzzy) return fuzzy;

  return null;
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

export function startCall(ctx: VoiceContext): VoiceStep {
  if (ctx.isNewShop) {
    return {
      state: "onboarding_name",
      agentText: SCRIPT.onboardingGreeting,
      done: false,
      ctx,
    };
  }
  // Auto-call (beat day scheduled call) — skip "good time" check, go straight to order
  if (ctx.isAutoCall) {
    const summary = summarize(ctx.repeatItems);
    return {
      state: summary ? "repeat_order" : "changes",
      agentText: summary
        ? SCRIPT.autoCallGreeting(ctx.shopName) + " " + SCRIPT.repeatOrder(summary)
        : SCRIPT.autoCallGreeting(ctx.shopName) + " " + SCRIPT.whatDoYouNeed,
      done: false,
      ctx: { ...ctx, currentSummary: summary, currentCart: [] },
    };
  }
  // Inbound call (shop owner calls us) — introduce ourselves, go straight to order
  if (ctx.isInbound) {
    const summary = summarize(ctx.repeatItems);
    return {
      state: summary ? "repeat_order" : "changes",
      agentText: SCRIPT.greetInbound + " " + (summary ? SCRIPT.repeatOrder(summary) : SCRIPT.whatDoYouNeed),
      done: false,
      ctx: { ...ctx, currentSummary: summary, currentCart: [] },
    };
  }
  // Outbound call (we call the shop) — identify them
  return {
    state: "greeting",
    agentText: SCRIPT.greet(ctx.shopName),
    done: false,
    ctx,
  };
}

export function step(
  state: VoiceState,
  userText: string,
  ctx: VoiceContext
): VoiceStep {
  const intent: Intent = detectIntent(userText);

  // Global pre-checks: intents that apply in any conversational state
  if (intent === "stop") {
    return endWith(state, SCRIPT.endOptOut, ctx, { optedOut: true });
  }
  if (intent === "catalog_query") {
    // Search products list immediately — no dead end
    const query = userText.replace(/(enna|irukka|available|stock|vum|ha| undo| ah)/gi, "").trim();
    const matched = findProduct(ctx.products, query);
    if (matched) {
      const inCart = ctx.currentCart.some((c) => c.product_id === matched.product_id);
      return {
        state: "changes",
        agentText: SCRIPT.catalogFound(matched.product_name, matched.brand, matched.price, matched.unit_type, inCart),
        done: false,
        ctx,
      };
    }
    // Try partial match — list all from same brand
    const brand = query.split(/\s+/)[0];
    const brandProducts = (ctx.products ?? []).filter(
      (p) => p.brand.toLowerCase().includes(brand.toLowerCase()) || brand.toLowerCase().includes(p.brand.toLowerCase())
    );
    if (brandProducts.length > 0) {
      const list = brandProducts.slice(0, 5).map((p) => `${p.product_name} ₹${p.price}`).join(", ");
      return { state: "changes", agentText: `Ivlo products irukku: ${list}. Enna venum?`, done: false, ctx };
    }
    return { state: "changes", agentText: SCRIPT.catalogNone, done: false, ctx };
  }
  // Informational queries (stock, credit, delivery, etc.) — don't push orders
  if (intent === "info") {
    return { state: "changes", agentText: SCRIPT.infoResponse, done: false, ctx };
  }
  // Callback request — ask for time
  if (intent === "callback" && state !== "callback_time" && state !== "callback_confirm") {
    return { state: "callback_time", agentText: SCRIPT.callbackAsk, done: false, ctx };
  }

  const inSubFlow =
    state === "complaint" ||
    state === "complaint_desc" ||
    state === "return_product" ||
    state === "return_qty" ||
    state === "return_reason" ||
    state.startsWith("onboarding_");

  if (!inSubFlow) {
    if (intent === "complaint") {
      return { state: "complaint", agentText: SCRIPT.complaintAsk, done: false, ctx };
    }
    if (intent === "return") {
      return { state: "return_product", agentText: SCRIPT.returnAsk, done: false, ctx };
    }
  }

  switch (state) {
    // ========== ONBOARDING FLOW (for new shops) ==========
    case "onboarding_name": {
      const name = userText.trim();
      // Filter garbage: too short, numbers only, or common STT noise
      if (!name || name.length < 2 || /^\d+$/.test(name) || /^(ha|ah|um|hm|ok|yes|no|sari|adi)$/i.test(name)) {
        return { state: "onboarding_name", agentText: SCRIPT.onboardingAskName, done: false, ctx };
      }
      return {
        state: "onboarding_area",
        agentText: SCRIPT.onboardingAskArea(name),
        done: false,
        ctx: {
          ...ctx,
          onboardingStep: "area",
          onboardingData: { ...ctx.onboardingData, shopName: name },
        },
      };
    }

    case "onboarding_area": {
      const area = userText.trim();
      if (!area || area.length < 2 || /^\d+$/.test(area) || /^(ha|ah|um|hm|ok|yes|no|sari|adi)$/i.test(area)) {
        return { state: "onboarding_area", agentText: SCRIPT.onboardingAskArea(""), done: false, ctx };
      }
      return {
        state: "onboarding_owner",
        agentText: SCRIPT.onboardingAskOwner(area),
        done: false,
        ctx: {
          ...ctx,
          onboardingStep: "owner",
          onboardingData: { ...ctx.onboardingData, area },
        },
      };
    }

    case "onboarding_owner": {
      const owner = userText.trim();
      if (!owner || owner.length < 2 || /^\d+$/.test(owner) || /^(ha|ah|um|hm|ok|yes|no|sari|adi)$/i.test(owner)) {
        return { state: "onboarding_owner", agentText: SCRIPT.onboardingAskOwner(""), done: false, ctx };
      }
      return {
        state: "onboarding_language",
        agentText: SCRIPT.onboardingAskLanguage(owner),
        done: false,
        ctx: {
          ...ctx,
          onboardingStep: "language",
          onboardingData: { ...ctx.onboardingData, ownerName: owner },
        },
      };
    }

    case "onboarding_language": {
      const lang = userText.toLowerCase().trim();
      const validLangs = ["tanglish", "tamil", "hindi", "english"];
      const matched = validLangs.find((l) => l.includes(lang) || lang.includes(l)) || "tanglish";
      return {
        state: "onboarding_complete",
        agentText: SCRIPT.onboardingConfirm(ctx.onboardingData.shopName ?? "", matched),
        done: false,
        ctx: {
          ...ctx,
          onboardingStep: "complete",
          onboardingData: { ...ctx.onboardingData, language: matched },
        },
      };
    }

    case "onboarding_complete": {
      if (intent === "yes") {
        return {
          state: "onboarding_done",
          agentText: SCRIPT.onboardingDone,
          done: true,
          ctx: { ...ctx, onboardingStep: "complete" },
        };
      }
      return { state: "onboarding_language", agentText: SCRIPT.onboardingAskLanguage(""), done: false, ctx };
    }

    // ========== CALLBACK / SCHEDULED CALLS ==========
    case "callback_time": {
      // Parse time from user input: "5 o clock", "6 mani", "evening", etc.
      const timeMatch = userText.match(/(\d{1,2})\s*(?:o\s*clock|mani|manikku|:\d{2})/i);
      const periodMatch = userText.match(/(morning|afternoon|evening|night)/i);
      let timeStr = "";
      if (timeMatch) {
        let hour = parseInt(timeMatch[1], 10);
        if (hour >= 1 && hour <= 12) {
          // Assume afternoon/evening for 1-7, morning for 8-12
          if (periodMatch) {
            const p = periodMatch[1].toLowerCase();
            if (p === "evening" || p === "afternoon" || p === "night") {
              if (hour < 12) hour += 12;
            }
          } else if (hour >= 1 && hour <= 7) {
            hour += 12; // assume PM
          }
          const h = hour > 12 ? hour - 12 : hour;
          const ampm = hour >= 12 ? "PM" : "AM";
          timeStr = `${h} ${ampm}`;
        }
      } else if (periodMatch) {
        const p = periodMatch[1].toLowerCase();
        if (p === "morning") timeStr = "9 AM";
        else if (p === "afternoon") timeStr = "2 PM";
        else if (p === "evening") timeStr = "6 PM";
        else if (p === "night") timeStr = "8 PM";
      }

      if (!timeStr) {
        return { state: "callback_time", agentText: SCRIPT.callbackTimeInvalid, done: false, ctx };
      }

      return {
        state: "callback_confirm",
        agentText: SCRIPT.callbackConfirm(timeStr),
        done: false,
        ctx: { ...ctx, pendingCallbackTime: timeStr },
      };
    }

    case "callback_confirm": {
      const time = ctx.pendingCallbackTime;
      if (!time) {
        return { state: "changes", agentText: SCRIPT.whatDoYouNeed, done: false, ctx };
      }
      // "permanent" or "always" → save to preferred_call_start
      const isPermanent = /permanent|always|every\s*time|ellam\s*time|every\s*day/i.test(userText);
      if (isPermanent) {
        return endWith(state, SCRIPT.callbackConfirmPermanent(time), ctx, { pendingCallbackTime: time });
      }
      // Default: temp for today only
      return endWith(state, SCRIPT.callbackConfirmTemp(time), ctx, { pendingCallbackTime: time });
    }

    // ========== MAIN ORDER FLOW ==========
    case "greeting": {
      // Accept any response — user may say "yes", "vanakkam", their name, etc.
      // "stop" is already handled by global pre-checks above
      return {
        state: "good_time",
        agentText: SCRIPT.goodTime,
        done: false,
        ctx,
      };
    }

    case "good_time": {
      if (intent === "yes") {
        const summary = summarize(ctx.repeatItems);
        return {
          state: summary ? "repeat_order" : "changes",
          agentText: summary ? SCRIPT.repeatOrder(summary) : SCRIPT.whatDoYouNeed,
          done: false,
          ctx: { ...ctx, currentSummary: summary, currentCart: [] },
        };
      }
      return endWith(state, SCRIPT.endNotGoodTime, ctx);
    }

    case "repeat_order": {
      // Convert repeat items to cart items (shared by both paths)
      const repeatAsCart: CartItem[] = ctx.repeatItems.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price ?? 0,
        line_total: (item.price ?? 0) * item.quantity,
      }));

      if (intent === "yes") {
        return {
          state: "read_back",
          agentText: SCRIPT.readBack(summarizeCart(repeatAsCart) ?? ""),
          done: false,
          ctx: { ...ctx, currentCart: repeatAsCart, currentSummary: summarizeCart(repeatAsCart) },
        };
      }
      // User wants to edit — keep repeat items in cart so they can add/remove
      return {
        state: "changes",
        agentText: SCRIPT.changes,
        done: false,
        ctx: { ...ctx, currentCart: repeatAsCart, currentSummary: summarizeCart(repeatAsCart) },
      };
    }

    case "changes": {
      // Parse add/remove commands
      const addMatch = userText.match(/(?:add|vadikka|add pannu|kudukku)\s+(\d+)\s*(?:pack|bottle|carton|box|jar|tube|pack)?\s*(.+)/i);
      const removeMatch = userText.match(/(?:remove|kuda|kuduthu|eduthu)\s+(\d+)?\s*(.+)/i);

      if (addMatch) {
        const qty = parseInt(addMatch[1], 10) || 1;
        const productQuery = addMatch[2].trim();

        // VERIFY PRODUCT EXISTS — don't hallucinate
        const matched = findProduct(ctx.products, productQuery);
        if (!matched) {
          return {
            state: "changes",
            agentText: SCRIPT.productNotFound(productQuery),
            done: false,
            ctx,
          };
        }

        // Product found — add to cart with verified data
        const newItem: CartItem = {
          product_id: matched.product_id,
          product_name: matched.product_name,
          quantity: qty,
          unit: matched.unit_type,
          price: matched.price,
          line_total: matched.price * qty,
        };
        const updatedCart = addToCart(ctx.currentCart, newItem);
        return {
          state: "changes",
          agentText: SCRIPT.addingToCart(matched.product_name, qty) + " " + SCRIPT.whatElse,
          done: false,
          ctx: { ...ctx, currentCart: updatedCart, currentSummary: summarizeCart(updatedCart) },
        };
      }

      if (removeMatch) {
        const qty = parseInt(removeMatch[1], 10);
        const productQuery = removeMatch[2].trim();

        // Find product in cart by name match
        const matched = findProduct(ctx.products, productQuery);
        if (!matched) {
          return {
            state: "changes",
            agentText: SCRIPT.productNotInCart(productQuery),
            done: false,
            ctx,
          };
        }

        const updatedCart = removeFromCart(ctx.currentCart, matched.product_id, qty || undefined);
        return {
          state: "changes",
          agentText: SCRIPT.removingFromCart(matched.product_name, qty || 1) + " " + SCRIPT.whatElse,
          done: false,
          ctx: { ...ctx, currentCart: updatedCart, currentSummary: summarizeCart(updatedCart) },
        };
      }

      // If user just says "done" or "seri" or "ok"
      if (intent === "yes" || /^(seri|ok|done|pogalam|mudichu)/i.test(userText)) {
        const summary = summarizeCart(ctx.currentCart);
        if (!summary) {
          return { state: "changes", agentText: SCRIPT.cartEmpty, done: false, ctx };
        }
        return {
          state: "read_back",
          agentText: SCRIPT.readBack(summary),
          done: false,
          ctx: { ...ctx, currentSummary: summary },
        };
      }

      // Default: treat as free-text change request (legacy behavior)
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
      if (ctx.corrections >= 2) {
        return endWith(state, SCRIPT.endNoConfirm, ctx);
      }
      return { state: "changes", agentText: SCRIPT.changes, done: false, ctx };
    }

    case "confirm": {
      // After confirmation, check for repeat-order upsell
      const repeatNotInCart = ctx.repeatItems.filter(
        (r) => !ctx.currentCart.some((c) => c.product_id === r.product_id)
      );
      if (repeatNotInCart.length > 0) {
        return {
          state: "upsell_repeat",
          agentText: SCRIPT.upsellRepeat(repeatNotInCart),
          done: false,
          ctx,
        };
      }
      return endWith(state, SCRIPT.endGood, ctx);
    }

    case "upsell_repeat": {
      if (intent === "yes") {
        // Add all repeat items not in cart
        const newItems: CartItem[] = ctx.repeatItems
          .filter((r) => !ctx.currentCart.some((c) => c.product_id === r.product_id))
          .map((item) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price ?? 0,
            line_total: (item.price ?? 0) * item.quantity,
          }));
        const updatedCart = [...ctx.currentCart, ...newItems];
        return endWith(state, SCRIPT.endGoodWithUpsell(summarizeCart(updatedCart) ?? ""), ctx, {
          currentCart: updatedCart,
          currentSummary: summarizeCart(updatedCart),
        });
      }
      return endWith(state, SCRIPT.endGood, ctx);
    }

    // ========== COMPLAINT SUB-FLOW ==========
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

    // ========== RETURN SUB-FLOW ==========
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
        agentText: SCRIPT.returnAskReason(ctx.pendingReturnProductName ?? "product", qty),
        done: false,
        ctx: { ...ctx, pendingReturnProductName: ctx.pendingReturnProductName ?? "product" },
      };
    }

    case "return_reason": {
      return endWith(
        state,
        SCRIPT.returnConfirm(ctx.pendingReturnProductName ?? "product", parseInt(userText.trim(), 10) || 1),
        ctx
      );
    }

    case "end":
      return { state: "end", agentText: "", done: true, ctx };

    default:
      // Unrecognized input — stay in current state, ask again
      return { state, agentText: SCRIPT.changes, done: false, ctx };
  }
}

export const STATE_LABELS: Record<VoiceState, string> = {
  greeting: "Greeting",
  good_time: "Good time?",
  repeat_order: "Suggest repeat",
  changes: "Taking changes",
  read_back: "Read back",
  confirm: "Confirming",
  upsell_repeat: "Upsell repeat",
  complaint: "Complaint type",
  complaint_desc: "Complaint details",
  return_product: "Return product",
  return_qty: "Return quantity",
  return_reason: "Return reason",
  callback_time: "Callback time",
  callback_confirm: "Callback confirm",
  onboarding_name: "Onboarding: name",
  onboarding_area: "Onboarding: area",
  onboarding_owner: "Onboarding: owner",
  onboarding_language: "Onboarding: language",
  onboarding_complete: "Onboarding: confirm",
  onboarding_done: "Onboarding: done",
  end: "Ended",
};