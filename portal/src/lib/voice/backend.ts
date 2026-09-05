import { supabase } from "@/lib/supabase";
import { todayIST } from "@/lib/format";
import { buildWhatsAppWaLink } from "@/lib/voice/whatsapp";
import type {
  AppLanguage,
  ComplaintType,
  MemoryType,
  OrderStatus,
  PaymentStatus,
  ReturnStatus,
  Severity,
} from "@/lib/types";

export class VoiceApiError extends Error {
  status: number;
  code: string;
  detail?: string;

  constructor(status: number, code: string, detail?: string) {
    super(code);
    this.name = "VoiceApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export function voiceErrorResponse(err: unknown): Response {
  if (err instanceof VoiceApiError) {
    return Response.json({ error: err.code, detail: err.detail }, { status: err.status });
  }
  console.error("[lyra-voice] unexpected error:", err);
  return Response.json({ error: "internal_error", detail: String(err) }, { status: 500 });
}

export interface BlacklistItem {
  product_id: string;
  product_name: string;
  reason: string | null;
}

export interface MemoryRowResult {
  memory_id: number;
  shop_id: string;
  memory_text: string;
  memory_type: MemoryType;
  confidence_score: number;
  confirmed_by_user: boolean;
  created_at: string;
}

export interface BlacklistRowResult {
  blacklist_id: number;
  shop_id: string;
  product_id: string;
  product_name: string;
  reason: string | null;
  created_at: string;
}

export interface LastOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  price: number;
}

export interface ShopContextResult {
  shop_id: string;
  shop_name: string;
  phone_number: string;
  owner_name: string | null;
  language: AppLanguage;
  language_detected: AppLanguage | null;
  preferred_call_time: string | null;
  is_within_call_time: boolean;
  credit_limit: number;
  outstanding_balance: number;
  available_credit: number;
  opt_out: boolean;
  blacklist: BlacklistItem[];
  last_order: LastOrderItem[];
  memories: { memory_text: string; memory_type: string; confidence_score: number }[];
  active_schemes: { scheme_name: string; benefit_type: string; benefit_value: number; eligible_products: string[] }[];
}

export interface SuggestedOrderResult {
  shop_id: string;
  shop_name: string;
  repeat_order: LastOrderItem[];
  missing_categories: string[];
  new_product: { product_id: string; product_name: string; price: number } | null;
  language_detected: AppLanguage | null;
}

export interface CheckStockResult {
  product_id: string;
  product_name: string;
  unit_type: string;
  available_qty: number;
  requested_qty: number | null;
  available: boolean;
  low_stock: boolean;
  language_detected: AppLanguage | null;
}

export interface CheckCreditResult {
  shop_id: string;
  shop_name: string;
  credit_limit: number;
  outstanding_balance: number;
  available_credit: number;
  order_total: number;
  approved: boolean;
  extra_payment_needed: number;
  language_detected: AppLanguage | null;
}

export interface CheckBlacklistResult {
  shop_id: string;
  product_id: string;
  is_blacklisted: boolean;
  reason: string | null;
  language_detected: AppLanguage | null;
}

export interface CreateOrderResult {
  order_id: string;
  shop_id: string;
  shop_name: string;
  total_amount: number;
  credit_used: number;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  items: CreatedOrderItem[];
  language_detected: AppLanguage | null;
}

export interface CreateReturnResult {
  return_id: number;
  shop_id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  reason: string | null;
  status: ReturnStatus;
  language_detected: AppLanguage | null;
}

export interface SaveComplaintResult {
  complaint_id: number;
  shop_id: string;
  complaint_type: string;
  description: string | null;
  severity: string;
  status: string;
  language_detected: AppLanguage | null;
}

export interface MarkOptOutResult {
  shop_id: string;
  shop_name: string;
  opt_out: boolean;
  voice_consent: boolean;
  language_detected: AppLanguage | null;
}

export interface SendWhatsAppResult {
  shop_id: string;
  order_id: string;
  whatsapp_sent: boolean;
  queued?: boolean;
  pending_id?: number;
  message_preview: string;
  language_detected: AppLanguage | null;
}

export interface SchemeItem {
  scheme_id: string;
  scheme_name: string;
  benefit_type: string;
  benefit_value: number;
  eligible_products: string[];
  start_date: string;
  end_date: string | null;
  minimum_quantity: number;
}

export interface GetSchemesResult {
  shop_id: string;
  schemes: SchemeItem[];
  language_detected: AppLanguage | null;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  language: AppLanguage | null;
}

export interface ConversationHistoryResult {
  call_id: string | null;
  shop_id: string;
  turns: ConversationTurn[];
  summary: string;
  language_detected: AppLanguage | null;
}

export interface CreatedOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  price: number;
  line_total: number;
}

export interface CreateOrderResult {
  order_id: string;
  shop_id: string;
  shop_name: string;
  total_amount: number;
  credit_used: number;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  items: CreatedOrderItem[];
}

const REAL_ORDER_STATUSES: OrderStatus[] = [
  "confirmed",
  "delivered",
  "payment_pending",
  "out_for_delivery",
];

// Shree Agencies' / Lyra's own collection UPI ID — the shop owner pays INTO
// this when their order exceeds the credit limit. App-wide constant, not per-shop.
export const LYRA_COLLECTION_UPI_ID = "9042113132@fam";

async function resolveProductNames(
  ids: string[]
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("products")
    .select("product_id, product_name")
    .in("product_id", ids);
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  return new Map((data ?? []).map((p) => [p.product_id, p.product_name]));
}

function normalizePhone(phone: string): string {
  return (phone ?? "").replace(/\D/g, "");
}

export async function identifyShopByPhone(phone: string) {
  const digits = normalizePhone(phone);
  if (!digits) throw new VoiceApiError(400, "phone_required");
  const tail = digits.length >= 10 ? digits.slice(-10) : digits;

  const { data, error } = await supabase
    .from("shops")
    .select("shop_id, shop_name, phone_number")
    .ilike("phone_number", `%${tail}`);
  if (error) throw new VoiceApiError(500, "db_error", error.message);

  const shop = (data ?? []).find((s: { phone_number: string }) => {
    const stored = normalizePhone(s.phone_number);
    return stored === digits || stored.slice(-10) === tail;
  });
  if (!shop) throw new VoiceApiError(404, "shop_not_found");
  return shop as { shop_id: string; shop_name: string; phone_number: string };
}

export async function getShopContext(shopId: string, languageDetected?: AppLanguage | null): Promise<ShopContextResult> {
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (shopError) throw new VoiceApiError(500, "db_error", shopError.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  const { data: credit, error: creditError } = await supabase
    .from("shop_credit")
    .select("available_credit")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (creditError) throw new VoiceApiError(500, "db_error", creditError.message);

  const { data: blacklist, error: blacklistError } = await supabase
    .from("blacklist")
    .select("product_id, reason, products(product_id, product_name)")
    .eq("shop_id", shopId);
  if (blacklistError) throw new VoiceApiError(500, "db_error", blacklistError.message);

  const lastOrder = await fetchLatestOrderItems(shopId);

  const preferredCallTime =
    shop.preferred_call_start && shop.preferred_call_end
      ? `${shop.preferred_call_start.slice(0, 5)}-${shop.preferred_call_end.slice(0, 5)}`
      : null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let isWithinCallTime = true;
  if (shop.preferred_call_start && shop.preferred_call_end) {
    const [startH, startM] = shop.preferred_call_start.split(":").map(Number);
    const [endH, endM] = shop.preferred_call_end.split(":").map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    isWithinCallTime = currentMinutes >= startMin && currentMinutes <= endMin;
  }

  const { data: memories } = await supabase
    .from("shop_memory")
    .select("memory_text, memory_type, confidence_score")
    .eq("shop_id", shopId)
    .order("confidence_score", { ascending: false })
    .limit(10);

  const { data: schemes } = await supabase
    .from("schemes")
    .select("scheme_name, benefit_type, benefit_value, eligible_product_ids")
    .eq("is_active", true);

  const blacklistRows = (blacklist as unknown as Array<{
    product_id: string;
    reason: string | null;
    products: Array<{ product_id: string; product_name: string }> | { product_id: string; product_name: string } | null;
  }> | null) ?? [];

  const detectedLanguage = languageDetected ?? shop.preferred_language as AppLanguage;

  return {
    shop_id: shop.shop_id,
    shop_name: shop.shop_name,
    phone_number: shop.phone_number,
    owner_name: shop.owner_name,
    language: shop.preferred_language as AppLanguage,
    language_detected: detectedLanguage,
    preferred_call_time: preferredCallTime,
    is_within_call_time: isWithinCallTime,
    credit_limit: Number(shop.credit_limit),
    outstanding_balance: Number(shop.outstanding_balance),
    available_credit: Number(credit?.available_credit ?? 0),
    opt_out: shop.opt_out,
    blacklist: blacklistRows.map((b) => {
      const product = Array.isArray(b.products) ? b.products[0] : b.products;
      return {
        product_id: b.product_id,
        product_name: product?.product_name ?? b.product_id,
        reason: b.reason,
      };
    }),
    last_order: lastOrder,
    memories: (memories ?? []).map((m) => ({
      memory_text: m.memory_text,
      memory_type: m.memory_type,
      confidence_score: Number(m.confidence_score),
    })),
    active_schemes: (schemes ?? []).map((s) => ({
      scheme_name: s.scheme_name,
      benefit_type: s.benefit_type,
      benefit_value: Number(s.benefit_value),
      eligible_products: s.eligible_product_ids,
    })),
  };
}

async function fetchLatestOrderItems(shopId: string): Promise<LastOrderItem[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_id, order_items(product_id, quantity, unit, price)")
    .eq("shop_id", shopId)
    .in("order_status", REAL_ORDER_STATUSES)
    .order("order_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new VoiceApiError(500, "db_error", error.message);

  const rows = (data?.order_items as
    | Array<{ product_id: string; quantity: number; unit: string; price: number }>
    | undefined) ?? [];
  if (rows.length === 0) return [];

  const names = await resolveProductNames(rows.map((r) => r.product_id));

  return rows.map((r) => ({
    product_id: r.product_id,
    product_name: names.get(r.product_id) ?? r.product_id,
    quantity: Number(r.quantity),
    unit: r.unit,
    price: Number(r.price),
  }));
}

export async function getSuggestedOrder(shopId: string, languageDetected?: AppLanguage | null): Promise<SuggestedOrderResult> {
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("shop_id, shop_name")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (shopError) throw new VoiceApiError(500, "db_error", shopError.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  const { data: blacklistRows } = await supabase
    .from("blacklist")
    .select("product_id")
    .eq("shop_id", shopId);
  const blacklistedIds = new Set((blacklistRows ?? []).map((b) => b.product_id));

  const rawRepeatOrder = await fetchLatestOrderItems(shopId);
  const repeatOrder = rawRepeatOrder.filter((i) => !blacklistedIds.has(i.product_id));

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("product_id, product_name, category, price")
    .eq("is_active", true);
  if (productsError) throw new VoiceApiError(500, "db_error", productsError.message);

  const orderedIds = new Set(repeatOrder.map((i) => i.product_id));
  const orderedCategories = new Set(
    (products ?? [])
      .filter((p) => orderedIds.has(p.product_id))
      .map((p) => p.category)
  );
  const allCategories = [...new Set((products ?? []).map((p) => p.category))];
  const missingCategories = allCategories.filter((c) => !orderedCategories.has(c));
  const newProduct =
    (products ?? []).find((p) => missingCategories.includes(p.category)) ?? null;

  return {
    shop_id: shop.shop_id,
    shop_name: shop.shop_name,
    repeat_order: repeatOrder,
    missing_categories: missingCategories,
    new_product: newProduct
      ? {
          product_id: newProduct.product_id,
          product_name: newProduct.product_name,
          price: Number(newProduct.price),
        }
      : null,
    language_detected: languageDetected ?? null,
  };
}

export async function checkStock(
  productId: string,
  requestedQty?: number
): Promise<CheckStockResult> {
  const { data, error } = await supabase
    .from("inventory")
    .select(
      "product_id, available_qty, low_stock_threshold, restock_date, products(product_id, product_name, unit_type)"
    )
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!data) throw new VoiceApiError(404, "product_not_found");

  const products = data.products as
    | Array<{ product_id: string; product_name: string; unit_type: string }>
    | { product_id: string; product_name: string; unit_type: string }
    | null;
  const product = Array.isArray(products) ? products[0] : products;
  const availableQty = Number(data.available_qty);
  return {
    product_id: data.product_id,
    product_name: product?.product_name ?? data.product_id,
    unit_type: product?.unit_type ?? "",
    available_qty: availableQty,
    requested_qty: requestedQty != null ? Number(requestedQty) : null,
    available: requestedQty == null || Number(requestedQty) <= availableQty,
    low_stock: availableQty <= Number(data.low_stock_threshold),
    language_detected: null,
  };
}

export async function checkCredit(
  shopId: string,
  orderTotal: number
): Promise<CheckCreditResult> {
  const total = Number(orderTotal);
  if (!Number.isFinite(total) || total < 0) {
    throw new VoiceApiError(400, "invalid_order_total");
  }

  const { data, error } = await supabase
    .from("shop_credit")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!data) throw new VoiceApiError(404, "shop_not_found");

  const available = Number(data.available_credit);
  return {
    shop_id: data.shop_id,
    shop_name: data.shop_name,
    credit_limit: Number(data.credit_limit),
    outstanding_balance: Number(data.outstanding_balance),
    available_credit: available,
    order_total: total,
    approved: total <= available,
    extra_payment_needed: Math.max(0, total - available),
    language_detected: null,
  };
}

export interface CreateOrderInputItem {
  product_id: string;
  quantity: number;
}

async function nextNumericId(prefix: string, from: "orders" | "call_logs"): Promise<string> {
  const { data, error } = await supabase.from(from).select(from === "orders" ? "order_id" : "call_id");
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  const pad = from === "orders" ? 4 : 3;
  const max = Math.max(
    0,
    ...(data ?? []).map((r) => {
      const id = from === "orders" ? (r as { order_id: string }).order_id : (r as { call_id: string }).call_id;
      const match = id.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
  );
  return `${prefix}${String(max + 1).padStart(pad, "0")}`;
}

export async function createOrder(
  shopId: string,
  items: CreateOrderInputItem[],
  opts: {
    payment_status?: PaymentStatus;
    order_status?: OrderStatus;
    transcript_summary?: string;
    language_detected?: AppLanguage | null;
    pending_reason?: string | null;
    credit_checked?: boolean;
  } = {}
): Promise<CreateOrderResult> {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!Array.isArray(items) || items.length === 0) {
    throw new VoiceApiError(400, "items_required");
  }

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("shop_id, shop_name, preferred_language, beat_route_id")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (shopError) throw new VoiceApiError(500, "db_error", shopError.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  // Fetch route's delivery_days for scheduling
  let deliveryDays = 3;
  if (shop.beat_route_id) {
    const { data: route } = await supabase
      .from("routes")
      .select("delivery_days")
      .eq("route_id", shop.beat_route_id)
      .maybeSingle();
    if (route?.delivery_days) deliveryDays = route.delivery_days;
  }

  const ids = [...new Set(items.map((i) => i.product_id))];
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("product_id, product_name, unit_type, price, is_active")
    .in("product_id", ids);
  if (productsError) throw new VoiceApiError(500, "db_error", productsError.message);

  const byId = new Map((products ?? []).map((p) => [p.product_id, p]));
  const lineItems: CreatedOrderItem[] = items.map((it) => {
    const product = byId.get(it.product_id);
    if (!product || !product.is_active) {
      throw new VoiceApiError(400, "invalid_product", it.product_id);
    }
    const quantity = Number(it.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new VoiceApiError(400, "invalid_quantity", it.product_id);
    }
    const price = Number(product.price);
    return {
      product_id: product.product_id,
      product_name: product.product_name,
      quantity,
      unit: product.unit_type,
      price,
      line_total: Math.round(price * quantity * 100) / 100,
    };
  });

  const totalAmount =
    Math.round(lineItems.reduce((sum, i) => sum + i.line_total, 0) * 100) / 100;
  const orderId = await nextNumericId("ORD", "orders");
  const callId = await nextNumericId("CALL", "call_logs");
  const today = todayIST();
  const deliveryDate = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { error: callError } = await supabase.from("call_logs").insert({
    call_id: callId,
    shop_id: shopId,
    end_time: new Date().toISOString(),
    language_detected: opts.language_detected ?? shop.preferred_language ?? null,
    sentiment: "positive",
    order_placed: true,
    whatsapp_sent: false,
    escalated_to_human: false,
    transcript_summary: opts.transcript_summary ?? null,
  });
  if (callError) throw new VoiceApiError(500, "db_error", callError.message);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_id: orderId,
      shop_id: shopId,
      call_id: callId,
      order_date: today,
      delivery_date: deliveryDate,
      delivery_slot: "2 PM - 5 PM",
      total_amount: totalAmount,
      credit_used: totalAmount,
      payment_status: opts.payment_status ?? "pending",
      order_status: opts.order_status ?? "awaiting_confirmation",
      confirmed_order: false,
      credit_checked: opts.credit_checked ?? false,
      pending_reason: opts.pending_reason ?? null,
      created_by: "AI",
    })
    .select()
    .single();
  if (orderError) throw new VoiceApiError(500, "db_error", orderError.message);

  const { error: itemsError } = await supabase.from("order_items").insert(
    lineItems.map((i) => ({
      order_id: orderId,
      product_id: i.product_id,
      quantity: i.quantity,
      unit: i.unit,
      price: i.price,
      line_total: i.line_total,
    }))
  );
  if (itemsError) throw new VoiceApiError(500, "db_error", itemsError.message);

  const { error: shopUpdateError } = await supabase
    .from("shops")
    .update({ last_order_date: today })
    .eq("shop_id", shopId);
  if (shopUpdateError) throw new VoiceApiError(500, "db_error", shopUpdateError.message);

  return {
    order_id: order.order_id,
    shop_id: shopId,
    shop_name: shop.shop_name,
    total_amount: totalAmount,
    credit_used: totalAmount,
    payment_status: order.payment_status,
    order_status: order.order_status,
    items: lineItems,
    language_detected: null,
  };
}

export async function saveMemory(
  shopId: string,
  memoryText: string,
  memoryType: MemoryType,
  confirmedByUser = false,
  confidenceScore = 0.5
) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!memoryText?.trim()) throw new VoiceApiError(400, "memory_text_required");

  const { data, error } = await supabase
    .from("shop_memory")
    .insert({
      shop_id: shopId,
      memory_text: memoryText.trim(),
      memory_type: memoryType,
      confidence_score: confidenceScore,
      confirmed_by_user: confirmedByUser,
    })
    .select()
    .single();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  return data as MemoryRowResult;
}

export async function updateMemory(
  memoryId: number,
  patch: {
    memory_text?: string;
    memory_type?: MemoryType;
    confidence_score?: number;
    confirmed_by_user?: boolean;
  }
): Promise<MemoryRowResult> {
  if (!Number.isFinite(memoryId)) throw new VoiceApiError(400, "memory_id_required");

  const update: Record<string, unknown> = {};
  if (patch.memory_text != null) update.memory_text = patch.memory_text.trim();
  if (patch.memory_type != null) update.memory_type = patch.memory_type;
  if (patch.confidence_score != null) update.confidence_score = Number(patch.confidence_score);
  if (patch.confirmed_by_user != null) update.confirmed_by_user = Boolean(patch.confirmed_by_user);
  if (Object.keys(update).length === 0) throw new VoiceApiError(400, "no_fields_to_update");

  const { data, error } = await supabase
    .from("shop_memory")
    .update(update)
    .eq("memory_id", memoryId)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") throw new VoiceApiError(404, "memory_not_found");
    throw new VoiceApiError(500, "db_error", error.message);
  }
  if (!data) throw new VoiceApiError(404, "memory_not_found");
  return data as MemoryRowResult;
}

export async function deleteShopMemory(memoryId: number): Promise<{ memory_id: number; deleted: true }> {
  if (!Number.isFinite(memoryId)) throw new VoiceApiError(400, "memory_id_required");

  const { error } = await supabase
    .from("shop_memory")
    .delete()
    .eq("memory_id", memoryId);
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  return { memory_id: memoryId, deleted: true };
}

export async function recordCallMemories(
  shopId: string,
  memories: Array<{
    memory_text: string;
    memory_type: MemoryType;
    confidence_score?: number;
    confirmed_by_user?: boolean;
  }>
): Promise<{ inserted: number; updated: number }> {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!Array.isArray(memories) || memories.length === 0) return { inserted: 0, updated: 0 };

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("shop_id")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (shopError) throw new VoiceApiError(500, "db_error", shopError.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  let inserted = 0;
  let updated = 0;

  for (const memory of memories) {
    const text = memory.memory_text?.trim();
    if (!text) continue;

    const { data: existing, error: selectError } = await supabase
      .from("shop_memory")
      .select("*")
      .eq("shop_id", shopId)
      .ilike("memory_text", text)
      .eq("memory_type", memory.memory_type)
      .order("memory_id", { ascending: true })
      .limit(1);
    if (selectError) throw new VoiceApiError(500, "db_error", selectError.message);

    if (existing && existing.length > 0) {
      const current = existing[0];
      const nextConfidence = Math.max(Number(current.confidence_score), memory.confidence_score ?? 0.5);
      const nextConfirmed = Boolean(current.confirmed_by_user) || Boolean(memory.confirmed_by_user);
      const { error: updateError } = await supabase
        .from("shop_memory")
        .update({
          memory_text: text,
          confidence_score: nextConfidence,
          confirmed_by_user: nextConfirmed,
        })
        .eq("memory_id", current.memory_id);
      if (updateError) throw new VoiceApiError(500, "db_error", updateError.message);
      updated++;
    } else {
      const { error: insertError } = await supabase
        .from("shop_memory")
        .insert({
          shop_id: shopId,
          memory_text: text,
          memory_type: memory.memory_type,
          confidence_score: memory.confidence_score ?? 0.5,
          confirmed_by_user: memory.confirmed_by_user ?? false,
        });
      if (insertError) throw new VoiceApiError(500, "db_error", insertError.message);
      inserted++;
    }
  }

  return { inserted, updated };
}

function normalizeComplaintType(raw: string): ComplaintType {
  const v = (raw || "").toLowerCase().replace(/[^a-z]/g, "");
  if (v.includes("damage") || v.includes("broken") || v.includes("tear") || v.includes("crush")) return "damaged_goods";
  if (v.includes("wrong") || v.includes("different") || v.includes("notwhat")) return "wrong_order";
  if (v.includes("late") || v.includes("delay") || v.includes("notreceived") || v.includes("notarrived")) return "late_delivery";
  if (v.includes("price") || v.includes("cost") || v.includes("expensive") || v.includes("charge")) return "price_issue";
  return "other";
}

function normalizeSeverity(raw: string | undefined): Severity {
  const v = (raw || "").toLowerCase().replace(/[^a-z]/g, "");
  if (v.includes("crit") || v.includes("sever")) return "critical";
  if (v.includes("urgent") || v.includes("high") || v.includes("angry")) return "high";
  if (v.includes("low") || v.includes("minor")) return "low";
  return "medium";
}

export async function saveComplaint(
  shopId: string,
  complaintType: string,
  description: string | null,
  opts: { severity?: Severity; callback_requested?: boolean } = {}
) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  const type = normalizeComplaintType(complaintType);
  if (!type) throw new VoiceApiError(400, "complaint_type_required");

  const baseRow = {
    shop_id: shopId,
    complaint_type: type,
    description: description?.trim() || null,
    severity: normalizeSeverity(opts.severity),
    status: "open",
    callback_requested: opts.callback_requested ?? false,
  };

  const insert = async (row: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("complaints")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const data: { complaint_id: number; shop_id: string; complaint_type: string; description: string | null; severity: string; status: string } = await insert(baseRow).catch(async (err) => {
    // Same stale-sequence fallback as returns: if the pkey sequence collides,
    // insert with the next explicit id so the call never hard-fails.
    if (String(err?.message || "").includes("complaints_pkey")) {
      const { data: maxRow } = await supabase
        .from("complaints")
        .select("complaint_id")
        .order("complaint_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      const next = Number(maxRow?.complaint_id ?? 0) + 1;
      return insert({ ...baseRow, complaint_id: next });
    }
    throw err;
  });
  return {
    complaint_id: data.complaint_id,
    shop_id: data.shop_id,
    complaint_type: data.complaint_type,
    description: data.description,
    severity: data.severity,
    status: data.status,
    language_detected: null,
  };
}

export async function markOptOut(shopId: string) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");

  const { data, error } = await supabase
    .from("shops")
    .update({ opt_out: true, voice_consent: false })
    .eq("shop_id", shopId)
    .select("shop_id, shop_name, opt_out, voice_consent")
    .single();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!data) throw new VoiceApiError(404, "shop_not_found");
  return {
    shop_id: data.shop_id,
    shop_name: data.shop_name,
    opt_out: data.opt_out,
    voice_consent: data.voice_consent,
    language_detected: null,
  };
}

export interface CheckBlacklistResult {
  shop_id: string;
  product_id: string;
  is_blacklisted: boolean;
  reason: string | null;
}

export async function checkBlacklist(
  shopId: string,
  productId: string
): Promise<CheckBlacklistResult> {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!productId) throw new VoiceApiError(400, "product_id_required");

  const { data, error } = await supabase
    .from("blacklist")
    .select("product_id, reason")
    .eq("shop_id", shopId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw new VoiceApiError(500, "db_error", error.message);

  return {
    shop_id: shopId,
    product_id: productId,
    is_blacklisted: !!data,
    reason: data?.reason ?? null,
    language_detected: null,
  };
}

export async function addBlacklistEntry(
  shopId: string,
  productId: string,
  reason?: string | null
): Promise<BlacklistRowResult> {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!productId) throw new VoiceApiError(400, "product_id_required");

  const payload: Record<string, unknown> = { shop_id: shopId, product_id: productId };
  if (reason != null) payload.reason = reason.trim() || null;

  const { data, error } = await supabase
    .from("blacklist")
    .upsert(payload, { onConflict: "shop_id,product_id" })
    .select("blacklist_id, shop_id, product_id, reason, created_at")
    .maybeSingle();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!data) throw new VoiceApiError(500, "db_error", "Blacklist upsert returned no row");

  const names = await resolveProductNames([data.product_id]);
  return {
    blacklist_id: data.blacklist_id,
    shop_id: data.shop_id,
    product_id: data.product_id,
    product_name: names.get(data.product_id) ?? data.product_id,
    reason: data.reason,
    created_at: data.created_at,
  };
}

export async function updateBlacklistEntry(
  blacklistId: number,
  patch: { reason?: string | null; product_id?: string }
): Promise<BlacklistRowResult> {
  if (!Number.isFinite(blacklistId)) throw new VoiceApiError(400, "blacklist_id_required");

  const update: Record<string, unknown> = {};
  if (patch.reason !== undefined) update.reason = patch.reason?.trim() || null;
  if (patch.product_id != null) update.product_id = patch.product_id;
  if (Object.keys(update).length === 0) throw new VoiceApiError(400, "no_fields_to_update");

  const { data, error } = await supabase
    .from("blacklist")
    .update(update)
    .eq("blacklist_id", blacklistId)
    .select("blacklist_id, shop_id, product_id, reason, created_at")
    .maybeSingle();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!data) throw new VoiceApiError(404, "blacklist_not_found");

  const names = await resolveProductNames([data.product_id]);
  return {
    blacklist_id: data.blacklist_id,
    shop_id: data.shop_id,
    product_id: data.product_id,
    product_name: names.get(data.product_id) ?? data.product_id,
    reason: data.reason,
    created_at: data.created_at,
  };
}

export async function deleteBlacklistEntry(blacklistId: number): Promise<{ blacklist_id: number; deleted: true }> {
  if (!Number.isFinite(blacklistId)) throw new VoiceApiError(400, "blacklist_id_required");

  const { error } = await supabase
    .from("blacklist")
    .delete()
    .eq("blacklist_id", blacklistId);
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  return { blacklist_id: blacklistId, deleted: true };
}

export async function removeBlacklistByProduct(
  shopId: string,
  productId: string
): Promise<{ deleted: boolean }> {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!productId) throw new VoiceApiError(400, "product_id_required");

  const { data, error } = await supabase
    .from("blacklist")
    .delete()
    .eq("shop_id", shopId)
    .eq("product_id", productId)
    .select("blacklist_id");
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  return { deleted: (data ?? []).length > 0 };
}

export interface SendWhatsAppResult {
  shop_id: string;
  order_id: string;
  whatsapp_sent: boolean;
  queued?: boolean;
  pending_id?: number;
  message_preview: string;
  wa_link?: string | null;
  language_detected: AppLanguage | null;
}

export interface ProductCatalogItem {
  product_id: string;
  product_name: string;
  brand: string;
  category: string;
  unit_type: string;
  price: number;
  tax_rate: number;
  is_active: boolean;
  available_qty?: number;
}

export interface ListProductsResult {
  products: ProductCatalogItem[];
  total: number;
  language_detected: AppLanguage | null;
}

export interface SearchCatalogResult {
  products: ProductCatalogItem[];
  query: string;
  language_detected: AppLanguage | null;
}

export interface CreateShopResult {
  shop_id: string;
  shop_name: string;
  phone_number: string;
  owner_name: string;
  area: string;
  preferred_language: string;
  language_detected: AppLanguage | null;
}

export async function sendWhatsAppSummary(
  shopId: string,
  orderId: string
): Promise<SendWhatsAppResult> {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!orderId) throw new VoiceApiError(400, "order_id_required");

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("shop_id, shop_name, whatsapp_number, whatsapp_consent")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (shopError) throw new VoiceApiError(500, "db_error", shopError.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");
  if (!shop.whatsapp_consent) throw new VoiceApiError(400, "whatsapp_not_consented");
  if (!shop.whatsapp_number) throw new VoiceApiError(400, "no_whatsapp_number");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("order_id, total_amount, delivery_date")
    .eq("order_id", orderId)
    .maybeSingle();
  if (orderError) throw new VoiceApiError(500, "db_error", orderError.message);
  if (!order) throw new VoiceApiError(404, "order_not_found");

  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, quantity, unit, price, line_total")
    .eq("order_id", orderId);
  const nameMap = await resolveProductNames([...new Set((items ?? []).map((i) => i.product_id))]);

  const lines = (items ?? []).map((i) => {
    const name = nameMap.get(i.product_id) ?? i.product_id;
    return `${i.quantity} x ${name} — ₹${Number(i.line_total).toFixed(0)}`;
  });

  const msg =
    `Hi ${shop.shop_name}! Your order ${orderId} is confirmed.\n` +
    lines.join("\n") +
    `\nTotal: ₹${Number(order.total_amount).toFixed(0)}` +
    (order.delivery_date ? `\nDelivery: ${order.delivery_date}` : "") +
    `\nThank you for ordering with Shree Agencies!`;

  const { data: pendingRow, error: pendingError } = await supabase
    .from("whatsapp_pending")
    .insert({
      shop_id: shopId,
      order_id: orderId,
      kind: "order_summary",
      message: msg,
      wa_link: buildWhatsAppWaLink(shop.whatsapp_number, msg),
      whatsapp_number: shop.whatsapp_number,
      status: "pending",
      agent_role: "order_taker",
    })
    .select("id")
    .single();
  if (pendingError) throw new VoiceApiError(500, "db_error", pendingError.message);

  return {
    shop_id: shopId,
    order_id: orderId,
    whatsapp_sent: false,
    queued: true,
    pending_id: pendingRow.id,
    message_preview: msg.slice(0, 200),
    wa_link: buildWhatsAppWaLink(shop.whatsapp_number, msg),
    language_detected: null,
  };
}

export interface CreateReturnResult {
  return_id: number;
  shop_id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  reason: string | null;
  status: ReturnStatus;
}

export async function createReturn(
  shopId: string,
  productId: string,
  quantity: number,
  reason: string | null,
  orderId?: string
): Promise<CreateReturnResult> {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!productId) throw new VoiceApiError(400, "product_id_required");
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new VoiceApiError(400, "invalid_quantity");
  }

  const { data: product } = await supabase
    .from("products")
    .select("product_id, price")
    .eq("product_id", productId)
    .maybeSingle();

  const creditNote = product ? Number(product.price) * quantity : 0;

  const baseRow = {
    shop_id: shopId,
    order_id: orderId ?? null,
    product_id: productId,
    quantity,
    reason: reason?.trim() || null,
    credit_note_amount: creditNote,
    status: "requested" as ReturnStatus,
  };

  const insert = async (row: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("returns")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const data: { return_id: number; status: string } = await insert(baseRow).catch(async (err) => {
    // Returns table pkey is BIGSERIAL; if a stale/misaligned DB sequence causes
    // a pkey collision (e.g. rows inserted earlier with explicit ids), fall back
    // to the next explicit id so the call never hard-fails mid-handoff.
    if (String(err?.message || "").includes("returns_pkey")) {
      const { data: maxRow } = await supabase
        .from("returns")
        .select("return_id")
        .order("return_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      const next = Number(maxRow?.return_id ?? 0) + 1;
      return insert({ ...baseRow, return_id: next });
    }
    throw err;
  });

  return {
    return_id: data.return_id,
    shop_id: shopId,
    order_id: orderId ?? null,
    product_id: productId,
    quantity,
    reason: reason ?? null,
    status: data.status as ReturnStatus,
    language_detected: null,
  };
}

export async function getSchemes(
  shopId: string,
  languageDetected?: AppLanguage | null
): Promise<GetSchemesResult> {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("shop_id, shop_name")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (shopError) throw new VoiceApiError(500, "db_error", shopError.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  const { data: schemes, error: schemesError } = await supabase
    .from("schemes")
    .select("scheme_id, scheme_name, benefit_type, benefit_value, eligible_product_ids, start_date, end_date, minimum_quantity")
    .eq("is_active", true)
    .or(`start_date.lte.${new Date().toISOString().slice(0,10)},start_date.is.null`)
    .or(`end_date.gte.${new Date().toISOString().slice(0,10)},end_date.is.null`);

  if (schemesError) throw new VoiceApiError(500, "db_error", schemesError.message);

  const { data: blacklistRows } = await supabase
    .from("blacklist")
    .select("product_id")
    .eq("shop_id", shopId);
  const blacklistedIds = new Set((blacklistRows ?? []).map((b) => b.product_id));

  const filteredSchemes = (schemes ?? []).map((s) => ({
    scheme_id: s.scheme_id,
    scheme_name: s.scheme_name,
    benefit_type: s.benefit_type,
    benefit_value: Number(s.benefit_value),
    eligible_products: (s.eligible_product_ids ?? []).filter((pid: string) => !blacklistedIds.has(pid)),
    start_date: s.start_date,
    end_date: s.end_date,
    minimum_quantity: Number(s.minimum_quantity ?? 1),
  })).filter((s) => s.eligible_products.length > 0);

  return {
    shop_id: shop.shop_id,
    schemes: filteredSchemes,
    language_detected: languageDetected ?? null,
  };
}

export async function getConversationHistory(
  callId: string | null,
  shopId: string | null,
  languageDetected?: AppLanguage | null
): Promise<ConversationHistoryResult> {
  if (!callId && !shopId) {
    throw new VoiceApiError(400, "call_id_or_shop_id_required");
  }

  let targetShopId = shopId;
  const targetCallId = callId;

  if (callId && !shopId) {
    const { data: callLog, error } = await supabase
      .from("call_logs")
      .select("shop_id")
      .eq("call_id", callId)
      .maybeSingle();
    if (error) throw new VoiceApiError(500, "db_error", error.message);
    if (!callLog) throw new VoiceApiError(404, "call_not_found");
    targetShopId = callLog.shop_id;
  }

  if (!targetShopId) {
    throw new VoiceApiError(400, "shop_id_required");
  }

  const turns: ConversationTurn[] = [];

  if (targetCallId) {
    const { data: callLog, error } = await supabase
      .from("call_logs")
      .select("transcript_summary, language_detected, start_time, end_time")
      .eq("call_id", targetCallId)
      .maybeSingle();
    if (error) throw new VoiceApiError(500, "db_error", error.message);
    if (callLog) {
      if (callLog.transcript_summary) {
        turns.push({
          role: "assistant",
          content: callLog.transcript_summary,
          timestamp: callLog.end_time ?? callLog.start_time,
          language: callLog.language_detected as AppLanguage | null,
        });
      }
    }
  }

  const { data: recentCalls } = await supabase
    .from("call_logs")
    .select("call_id, transcript_summary, language_detected, start_time, end_time")
    .eq("shop_id", targetShopId)
    .order("start_time", { ascending: false })
    .limit(5);

  if (recentCalls && recentCalls.length > 0) {
    for (const call of recentCalls) {
      if (call.call_id !== targetCallId && call.transcript_summary) {
        turns.unshift({
          role: "assistant",
          content: call.transcript_summary,
          timestamp: call.end_time ?? call.start_time,
          language: call.language_detected as AppLanguage | null,
        });
      }
    }
  }

  const summary = turns
    .map((t) => `[${t.language || "unknown"}] ${t.role}: ${t.content}`)
    .join("\n");

  return {
    call_id: targetCallId,
    shop_id: targetShopId,
    turns,
    summary: summary || "No previous conversation history.",
    language_detected: languageDetected ?? null,
  };
}

export async function listProducts(
  opts: {
    category?: string;
    brand?: string;
    in_stock_only?: boolean;
    languageDetected?: AppLanguage | null;
  } = {}
): Promise<ListProductsResult> {
  const { category, brand, in_stock_only, languageDetected } = opts;

  let query = supabase
    .from("products")
    .select(
      "product_id, product_name, brand, category, unit_type, price, tax_rate, is_active, inventory(available_qty)"
    )
    .eq("is_active", true);

  if (category) query = query.eq("category", category);
  if (brand) query = query.eq("brand", brand);

  const { data, error } = await query.order("brand", { ascending: true }).order("product_name", { ascending: true });
  if (error) throw new VoiceApiError(500, "db_error", error.message);

  const products: ProductCatalogItem[] = ((data ?? []) as Array<{
    product_id: string;
    product_name: string;
    brand: string;
    category: string;
    unit_type: string;
    price: number;
    tax_rate: number;
    is_active: boolean;
    inventory: Array<{ available_qty: number }> | { available_qty: number } | null;
  }>).map((p) => {
    const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
    return {
      product_id: p.product_id,
      product_name: p.product_name,
      brand: p.brand,
      category: p.category,
      unit_type: p.unit_type,
      price: Number(p.price),
      tax_rate: Number(p.tax_rate),
      is_active: p.is_active,
      available_qty: inv ? Number(inv.available_qty) : 0,
    };
  });

  const filtered = in_stock_only ? products.filter((p) => (p.available_qty ?? 0) > 0) : products;

  return {
    products: filtered,
    total: filtered.length,
    language_detected: languageDetected ?? null,
  };
}

export async function searchCatalog(
  query: string,
  languageDetected?: AppLanguage | null
): Promise<SearchCatalogResult> {
  if (!query?.trim()) {
    return { products: [], query: query ?? "", language_detected: languageDetected ?? null };
  }

  const searchTerm = query.trim();

  const { data, error } = await supabase
    .from("products")
    .select(
      "product_id, product_name, brand, category, unit_type, price, tax_rate, is_active, inventory(available_qty)"
    )
    .eq("is_active", true)
    .or(`product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`)
    .order("brand", { ascending: true })
    .order("product_name", { ascending: true })
    .limit(20);

  if (error) throw new VoiceApiError(500, "db_error", error.message);

  const products: ProductCatalogItem[] = ((data ?? []) as Array<{
    product_id: string;
    product_name: string;
    brand: string;
    category: string;
    unit_type: string;
    price: number;
    tax_rate: number;
    is_active: boolean;
    inventory: Array<{ available_qty: number }> | { available_qty: number } | null;
  }>).map((p) => {
    const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
    return {
      product_id: p.product_id,
      product_name: p.product_name,
      brand: p.brand,
      category: p.category,
      unit_type: p.unit_type,
      price: Number(p.price),
      tax_rate: Number(p.tax_rate),
      is_active: p.is_active,
      available_qty: inv ? Number(inv.available_qty) : 0,
    };
  });

  return {
    products,
    query: searchTerm,
    language_detected: languageDetected ?? null,
  };
}

export async function createShop(
  input: {
    phone_number: string;
    shop_name: string;
    owner_name: string;
    area: string;
    preferred_language: string;
    beat_route_id?: string | null;
    preferred_call_start?: string | null;
    preferred_call_end?: string | null;
  },
  languageDetected?: AppLanguage | null
): Promise<CreateShopResult> {
  const {
    phone_number,
    shop_name,
    owner_name,
    area,
    preferred_language,
    beat_route_id,
    preferred_call_start,
    preferred_call_end,
  } = input;

  const digits = normalizePhone(phone_number);
  if (!digits) throw new VoiceApiError(400, "phone_required");
  if (!shop_name?.trim()) throw new VoiceApiError(400, "shop_name_required");
  if (!owner_name?.trim()) throw new VoiceApiError(400, "owner_name_required");
  if (!area?.trim()) throw new VoiceApiError(400, "area_required");

  const validLanguages = ["tanglish", "tamil", "hindi", "english"];
  const lang = validLanguages.includes(preferred_language.toLowerCase()) ? preferred_language.toLowerCase() : "tanglish";

  // Check if shop already exists with this phone (primary or added)
  const { data: existing } = await supabase
    .from("shops")
    .select("shop_id")
    .ilike("phone_number", `%${digits.slice(-10)}`)
    .maybeSingle();
  if (existing) throw new VoiceApiError(409, "shop_already_exists");

  if (beat_route_id) {
    const { data: route } = await supabase
      .from("routes")
      .select("route_id")
      .eq("route_id", beat_route_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!route) throw new VoiceApiError(400, "invalid_beat");
  }

  const shopId = `S${Date.now().toString().slice(-3)}`;

  const { data, error } = await supabase
    .from("shops")
    .insert({
      shop_id: shopId,
      shop_name: shop_name.trim(),
      owner_name: owner_name.trim(),
      phone_number: digits,
      whatsapp_number: digits,
      preferred_language: lang,
      preferred_call_start: preferred_call_start?.slice(0, 5) || null,
      preferred_call_end: preferred_call_end?.slice(0, 5) || null,
      // beat/route is written ONLY when the owner has confirmed it (never auto-assigned)
      beat_route_id: beat_route_id ?? null,
      visit_gap_days: 7,
      credit_limit: 5000,
      outstanding_balance: 0,
      voice_consent: true,
      whatsapp_consent: true,
      opt_out: false,
    })
    .select()
    .single();

  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!data) throw new VoiceApiError(500, "db_error", "Shop creation failed");

  // Initialize shop_credit
  await supabase.from("shop_credit").insert({
    shop_id: data.shop_id,
    credit_limit: 5000,
    outstanding_balance: 0,
    available_credit: 5000,
  });

  // Register the primary phone in shop_phones
  await supabase.from("shop_phones").insert({
    shop_id: data.shop_id,
    phone_number: digits,
    label: "primary",
    is_primary: true,
  });

  return {
    shop_id: data.shop_id,
    shop_name: data.shop_name,
    phone_number: data.phone_number,
    owner_name: data.owner_name,
    area,
    preferred_language: lang,
    language_detected: languageDetected ?? null,
  };
}

export async function identifyShopByAnyPhone(phone: string) {
  const digits = normalizePhone(phone);
  if (!digits) throw new VoiceApiError(400, "phone_required");
  const tail = digits.length >= 10 ? digits.slice(-10) : digits;

  // 1) Primary phone on shops
  const { data: shops } = await supabase
    .from("shops")
    .select("shop_id, phone_number")
    .ilike("phone_number", `%${tail}`);
  const shopId = (shops ?? []).find((s: { phone_number: string }) => {
    const stored = normalizePhone(s.phone_number);
    return stored === digits || stored.slice(-10) === tail;
  })?.shop_id;

  // 2) Added phones on shop_phones
  let resolvedShopId = shopId;
  if (!resolvedShopId) {
    const { data: sp } = await supabase
      .from("shop_phones")
      .select("shop_id, phone_number")
      .ilike("phone_number", `%${tail}`);
    resolvedShopId = (sp ?? []).find((r: { phone_number: string }) => {
      const stored = normalizePhone(r.phone_number);
      return stored === digits || stored.slice(-10) === tail;
    })?.shop_id;
  }

  if (!resolvedShopId) throw new VoiceApiError(404, "shop_not_found", "new_shop");

  const { data: shop, error } = await supabase
    .from("shops")
    .select("shop_id, shop_name, owner_name, phone_number, preferred_language")
    .eq("shop_id", resolvedShopId)
    .maybeSingle();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  const { data: phones, error: phonesError } = await supabase
    .from("shop_phones")
    .select("phone_number, label, is_primary")
    .eq("shop_id", shop.shop_id);
  if (phonesError) throw new VoiceApiError(500, "db_error", phonesError.message);

  const { data: credit } = await supabase
    .from("shop_credit")
    .select("credit_limit, outstanding_balance, available_credit")
    .eq("shop_id", shop.shop_id)
    .maybeSingle();

  return {
    shop_id: shop.shop_id,
    shop_name: shop.shop_name,
    owner_name: shop.owner_name,
    phone_number: shop.phone_number,
    all_phones: (phones ?? []).map((p) => p.phone_number),
    language: shop.preferred_language as AppLanguage,
    credit_limit: Number(credit?.credit_limit ?? 0),
    outstanding_balance: Number(credit?.outstanding_balance ?? 0),
    available_credit: Number(credit?.available_credit ?? 0),
  };
}

export async function addShopPhone(
  shopId: string,
  phoneNumber: string,
  label = "alt"
) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  const digits = normalizePhone(phoneNumber);
  if (!digits) throw new VoiceApiError(400, "phone_required");

  const { data: shop, error } = await supabase
    .from("shops")
    .select("shop_id")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  const { data, error: insError } = await supabase
    .from("shop_phones")
    .insert({ shop_id: shopId, phone_number: digits, label })
    .select()
    .single();
  if (insError) {
    if (insError.code === "23505") throw new VoiceApiError(409, "phone_already_exists");
    throw new VoiceApiError(500, "db_error", insError.message);
  }

  return { phone_id: data.phone_id, shop_id: data.shop_id, phone_number: data.phone_number, label: data.label };
}

export async function updateShop(
  shopId: string,
  patch: {
    shop_name?: string;
    owner_name?: string;
    area?: string;
    preferred_language?: string;
    preferred_call_start?: string | null;
    preferred_call_end?: string | null;
    beat_route_id?: string | null;
  }
) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");

  const { data: shop, error } = await supabase
    .from("shops")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  // Merge current + patch to return a "draft" for confirm-first
  const draft = {
    shop_name: patch.shop_name?.trim() || shop.shop_name,
    owner_name: patch.owner_name?.trim() || shop.owner_name,
    preferred_language: patch.preferred_language || shop.preferred_language,
    preferred_call_start: patch.preferred_call_start != null ? patch.preferred_call_start.slice(0, 5) : shop.preferred_call_start,
    preferred_call_end: patch.preferred_call_end != null ? patch.preferred_call_end.slice(0, 5) : shop.preferred_call_end,
    beat_route_id: patch.beat_route_id != null ? patch.beat_route_id : shop.beat_route_id,
  };
  if (draft.beat_route_id) {
    const { data: route } = await supabase
      .from("routes")
      .select("route_id")
      .eq("route_id", draft.beat_route_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!route) throw new VoiceApiError(400, "invalid_beat");
  }

  return {
    draft,
    confirmed: false,
    shop_id: shopId,
    note: "Review draft and call again with confirmed=true to apply",
  };
}

export async function applyShopUpdate(
  shopId: string,
  confirmed: boolean,
  patch: {
    shop_name?: string;
    owner_name?: string;
    preferred_language?: string;
    preferred_call_start?: string | null;
    preferred_call_end?: string | null;
    beat_route_id?: string | null;
  }
) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!confirmed) throw new VoiceApiError(400, "confirm_required");

  const update: Record<string, unknown> = {};
  if (patch.shop_name != null) update.shop_name = patch.shop_name.trim();
  if (patch.owner_name != null) update.owner_name = patch.owner_name.trim();
  if (patch.preferred_language != null) update.preferred_language = patch.preferred_language;
  if (patch.preferred_call_start != null) update.preferred_call_start = patch.preferred_call_start.slice(0, 5) || null;
  if (patch.preferred_call_end != null) update.preferred_call_end = patch.preferred_call_end.slice(0, 5) || null;
  if (patch.beat_route_id != null) {
    if (patch.beat_route_id) {
      const { data: route } = await supabase
        .from("routes")
        .select("route_id")
        .eq("route_id", patch.beat_route_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!route) throw new VoiceApiError(400, "invalid_beat");
    }
    update.beat_route_id = patch.beat_route_id || null;
  }

  if (Object.keys(update).length === 0) {
    const { data: existing } = await supabase
      .from("shops")
      .select("shop_id, shop_name, owner_name, beat_route_id, preferred_language")
      .eq("shop_id", shopId)
      .maybeSingle();
    if (existing) {
      return {
        shop_id: existing.shop_id,
        shop_name: existing.shop_name,
        owner_name: existing.owner_name,
        beat_route_id: existing.beat_route_id,
        preferred_language: existing.preferred_language,
        confirmed: true,
      };
    }
  }

  const { data, error } = await supabase
    .from("shops")
    .update(update)
    .eq("shop_id", shopId)
    .select()
    .single();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!data) throw new VoiceApiError(404, "shop_not_found");

  return {
    shop_id: data.shop_id,
    shop_name: data.shop_name,
    owner_name: data.owner_name,
    beat_route_id: data.beat_route_id,
    preferred_language: data.preferred_language,
    confirmed: true,
  };
}

export async function listBeats() {
  const { data, error } = await supabase
    .from("routes")
    .select("route_id, route_name, coverage_area, salesperson")
    .eq("is_active", true)
    .order("route_id", { ascending: true });
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  return (data ?? []).map((r) => ({
    route_id: r.route_id,
    route_name: r.route_name,
    area: r.coverage_area,
    salesperson: r.salesperson,
  }));
}

export async function sendOrderConfirmationWhatsApp(shopId: string, orderId: string): Promise<{ success: boolean; message_preview?: string; wa_link?: string | null; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/whatsapp/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, order_id: orderId }),
    });
    const data = await res.json();
    return { success: data.success, message_preview: data.message_preview, wa_link: data.wa_link ?? null, error: data.error };
  } catch (err) {
    console.error("[sendOrderConfirmationWhatsApp] error:", err);
    return { success: false, error: String(err) };
  }
}

export async function sendSchemesWhatsApp(shopId: string): Promise<{ success: boolean; message_preview?: string; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/whatsapp/schemes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId }),
    });
    const data = await res.json();
    return { success: data.success, message_preview: data.message_preview, error: data.error };
  } catch (err) {
    console.error("[sendSchemesWhatsApp] error:", err);
    return { success: false, error: String(err) };
  }
}

export async function sendPaymentLinkWhatsApp(shopId: string, orderId: string, amountDue: number, reason: "credit_exceeded" | "high_value_order"): Promise<{ success: boolean; message_preview?: string; error?: string; upi_link?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/whatsapp/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, order_id: orderId, amount_due: amountDue, reason }),
    });
    const data = await res.json();
    return { success: data.success, message_preview: data.message_preview, error: data.error, upi_link: data.upi_link };
  } catch (err) {
    console.error("[sendPaymentLinkWhatsApp] error:", err);
    return { success: false, error: String(err) };
  }
}

export async function sendDeliveryUpdateWhatsApp(deliveryId: number): Promise<{ success: boolean; message_preview?: string; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/whatsapp/delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delivery_id: deliveryId }),
    });
    const data = await res.json();
    return { success: data.success, message_preview: data.message_preview, error: data.error };
  } catch (err) {
    console.error("[sendDeliveryUpdateWhatsApp] error:", err);
    return { success: false, error: String(err) };
  }
}

export async function sendReturnPhotoRequestWhatsApp(returnId: number): Promise<{ success: boolean; message_preview?: string; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/whatsapp/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ return_id: returnId }),
    });
    const data = await res.json();
    return { success: data.success, message_preview: data.message_preview, error: data.error };
  } catch (err) {
    console.error("[sendReturnPhotoRequestWhatsApp] error:", err);
    return { success: false, error: String(err) };
  }
}

export async function sendMonthlyStatementWhatsApp(shopId: string, period?: string): Promise<{ success: boolean; message_preview?: string; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/whatsapp/statement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, period }),
    });
    const data = await res.json();
    return { success: data.success, message_preview: data.message_preview, error: data.error };
  } catch (err) {
    console.error("[sendMonthlyStatementWhatsApp] error:", err);
    return { success: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Multi-agent MVP (v3) — Phase B additions
// ---------------------------------------------------------------------------

export interface BrandPriceFilter {
  brand?: string;
  price?: number;
}

export async function findProductByBrandPrice(
  filter: { brand?: string; price?: number; name?: string },
  languageDetected?: AppLanguage | null
): Promise<{ product?: ProductCatalogItem; candidates: ProductCatalogItem[]; language_detected: AppLanguage | null }> {
  const brand = filter.brand?.trim();
  const price = filter.price;
  const name = filter.name?.trim();

  let query = supabase
    .from("products")
    .select(
      "product_id, product_name, brand, category, unit_type, price, tax_rate, is_active, inventory(available_qty)"
    )
    .eq("is_active", true);

  if (brand) query = query.ilike("brand", `%${brand}%`);
  if (name) query = query.ilike("product_name", `%${name}%`);

  const { data, error } = await query.order("brand", { ascending: true }).order("product_name", { ascending: true }).limit(20);
  if (error) throw new VoiceApiError(500, "db_error", error.message);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((p) => {
    const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
    return {
      product_id: p.product_id as string,
      product_name: p.product_name as string,
      brand: (p.brand as string) ?? "",
      category: (p.category as string) ?? "",
      unit_type: (p.unit_type as string) ?? "",
      price: Number(p.price),
      tax_rate: Number(p.tax_rate),
      is_active: p.is_active as boolean,
      available_qty: inv ? Number((inv as { available_qty: number }).available_qty) : 0,
    };
  });

  let candidates = rows;
  if (price != null && Number.isFinite(price)) {
    const exact = rows.filter((p) => p.price === price);
    candidates = exact.length ? exact : rows.filter((p) => Math.abs(p.price - price) <= 1);
    if (!candidates.length) candidates = rows;
  }

  return {
    product: candidates[0],
    candidates,
    language_detected: languageDetected ?? null,
  };
}

export async function reserveStock(
  productId: string,
  qty: number,
  remove = false
): Promise<{ product_id: string; reserved_qty: number; available_qty: number; available: boolean; language_detected: AppLanguage | null }> {
  if (!productId) throw new VoiceApiError(400, "product_id_required");
  const amount = Number(qty);
  if (!Number.isFinite(amount) || amount <= 0) throw new VoiceApiError(400, "invalid_quantity");

  const { data: inv } = await supabase
    .from("inventory")
    .select("product_id, available_qty, reserved_qty")
    .eq("product_id", productId)
    .maybeSingle();
  if (!inv) throw new VoiceApiError(404, "product_not_found");

  const available = Number(inv.available_qty);
  const reserved = Number(inv.reserved_qty);
  const delta = remove ? -amount : amount;
  if (!remove && delta > available) {
    return {
      product_id: productId,
      reserved_qty: reserved,
      available_qty: available,
      available: false,
      language_detected: null,
    };
  }

  const newReserved = Math.max(0, reserved + delta);
  const { error } = await supabase
    .from("inventory")
    .update({ reserved_qty: newReserved })
    .eq("product_id", productId);
  if (error) throw new VoiceApiError(500, "db_error", error.message);

  return {
    product_id: productId,
    reserved_qty: newReserved,
    available_qty: available,
    available: true,
    language_detected: null,
  };
}

export async function confirmOrder(
  orderId: string,
  opts: { performed_by?: string; send_whatsapp?: boolean } = {}
): Promise<{
  order_id: string;
  shop_id: string;
  confirmed_order: boolean;
  order_status: OrderStatus;
  stock_decremented: boolean;
  whatsapp_sent: boolean;
  wa_link?: string | null;
  error?: string;
  language_detected: AppLanguage | null;
}> {
  if (!orderId) throw new VoiceApiError(400, "order_id_required");

  const { data: order, error } = await supabase
    .from("orders")
    .select("order_id, shop_id, order_status, confirmed_order")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
  if (!order) throw new VoiceApiError(404, "order_not_found");

  if (order.confirmed_order) {
    return {
      order_id: order.order_id,
      shop_id: order.shop_id,
      confirmed_order: true,
      order_status: order.order_status,
      stock_decremented: false,
      whatsapp_sent: false,
      language_detected: null,
    };
  }

  // Reserve→confirm: decrement inventory and record stock movements in one pass
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);
  if (itemsError) throw new VoiceApiError(500, "db_error", itemsError.message);

  const movements = (items ?? []).map((it) => ({
    product_id: it.product_id,
    change_qty: -Number(it.quantity),
    reason: "order_confirmation",
    reference_id: orderId,
    reference_type: "order",
    performed_by: opts.performed_by ?? "portal",
  }));

  for (const m of movements) {
    const { data: inv } = await supabase
      .from("inventory")
      .select("available_qty, reserved_qty")
      .eq("product_id", m.product_id)
      .maybeSingle();
    if (inv) {
      const newAvailable = Math.max(0, Number(inv.available_qty) - Math.abs(m.change_qty));
      const newReserved = Math.max(0, Number(inv.reserved_qty) - Math.abs(m.change_qty));
      await supabase
        .from("inventory")
        .update({ available_qty: newAvailable, reserved_qty: newReserved })
        .eq("product_id", m.product_id);
    }
  }
  if (movements.length) {
    await supabase.from("stock_movements").insert(movements);
  }

  const { error: updError } = await supabase
    .from("orders")
    .update({
      confirmed_order: true,
      order_status: "confirmed",
      credit_checked: true,
      pending_reason: null,
    })
    .eq("order_id", orderId);
  if (updError) throw new VoiceApiError(500, "db_error", updError.message);

  let whatsapp_sent = false;
  let waError: string | undefined;
  let waLink: string | null = null;
  if (opts.send_whatsapp !== false) {
    const res = await sendOrderConfirmationWhatsApp(order.shop_id, orderId);
    whatsapp_sent = !!res.success;
    waError = res.error;
    waLink = res.wa_link ?? null;
  }

  return {
    order_id: orderId,
    shop_id: order.shop_id,
    confirmed_order: true,
    order_status: "confirmed",
    stock_decremented: true,
    whatsapp_sent,
    wa_link: waLink,
    error: waError,
    language_detected: null,
  };
}

export async function getShopCreditHistory(
  shopId: string,
  languageDetected?: AppLanguage | null
) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");

  const { data: shop } = await supabase
    .from("shops")
    .select("shop_id, shop_name")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  const { data: credit } = await supabase
    .from("shop_credit")
    .select("credit_limit, outstanding_balance, available_credit")
    .eq("shop_id", shopId)
    .maybeSingle();

  const { data: payments } = await supabase
    .from("payments")
    .select("payment_id, amount, method, reference, collected_at, notes")
    .eq("shop_id", shopId)
    .order("collected_at", { ascending: false })
    .limit(50);

  const { data: orders } = await supabase
    .from("orders")
    .select("order_id, order_date, total_amount, order_status, confirmed_order")
    .eq("shop_id", shopId)
    .in("order_status", REAL_ORDER_STATUSES)
    .order("order_date", { ascending: false })
    .limit(50);

  const { data: returns } = await supabase
    .from("returns")
    .select("return_id, product_id, quantity, reason, status, created_at")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    shop_id: shopId,
    shop_name: shop.shop_name,
    credit: {
      credit_limit: Number(credit?.credit_limit ?? 0),
      outstanding_balance: Number(credit?.outstanding_balance ?? 0),
      available_credit: Number(credit?.available_credit ?? 0),
    },
    payments: (payments ?? []).map((p) => ({
      payment_id: p.payment_id,
      amount: Number(p.amount),
      method: p.method,
      reference: p.reference,
      collected_at: p.collected_at,
      notes: p.notes,
    })),
    orders: (orders ?? []).map((o) => ({
      order_id: o.order_id,
      order_date: o.order_date,
      total_amount: Number(o.total_amount),
      order_status: o.order_status,
      confirmed_order: o.confirmed_order,
    })),
    returns: (returns ?? []).map((r) => ({
      return_id: r.return_id,
      product_id: r.product_id,
      quantity: Number(r.quantity),
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
    })),
    language_detected: languageDetected ?? null,
  };
}

export async function getShopDeliveryHistory(
  shopId: string,
  languageDetected?: AppLanguage | null
) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");

  const { data: shop } = await supabase
    .from("shops")
    .select("shop_id, shop_name")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  const { data: deliveries, error } = await supabase
    .from("deliveries")
    .select(
      "delivery_id, order_id, delivery_date, delivery_slot, vehicle_no, delivery_person, status, notes, delivery_items(delivered_qty, returned_qty, order_item_id)"
    )
    .order("delivery_date", { ascending: false })
    .limit(50);

  if (error) throw new VoiceApiError(500, "db_error", error.message);

  const orderIds = [...new Set((deliveries ?? []).map((d) => d.order_id))];
  const ordersById = new Map<string, { total_amount: number; shop_id: string }>();
  if (orderIds.length) {
    const { data: ords } = await supabase
      .from("orders")
      .select("order_id, total_amount, shop_id")
      .in("order_id", orderIds);
    (ords ?? []).forEach((o) => ordersById.set(o.order_id, o));
  }

  const itemIds = [
    ...new Set(
      (deliveries ?? []).flatMap((d) =>
        ((d.delivery_items as Array<{ order_item_id: number }>) ?? []).map((i) => i.order_item_id)
      )
    ),
  ];
  const itemsById = new Map<number, { product_id: string; quantity: number; unit: string; price: number }>();
  if (itemIds.length) {
    const { data: oi } = await supabase
      .from("order_items")
      .select("order_item_id, product_id, quantity, unit, price")
      .in("order_item_id", itemIds);
    (oi ?? []).forEach((i) => itemsById.set(i.order_item_id, i));
  }
  const productIds = [...new Set([...itemsById.values()].map((i) => i.product_id))];
  const productNames = await resolveProductNames(productIds);

  const result = (deliveries ?? [])
    .filter((d) => ordersById.get(d.order_id)?.shop_id === shopId)
    .map((d) => {
      const orderItems = ((d.delivery_items as Array<{ order_item_id: number; delivered_qty: number; returned_qty: number }>) ?? []).map((di) => {
        const oi = itemsById.get(di.order_item_id);
        return {
          product_id: oi?.product_id,
          product_name: oi ? productNames.get(oi.product_id) ?? oi.product_id : null,
          quantity: Number(di.delivered_qty),
          unit: oi?.unit,
          price: oi ? Number(oi.price) : 0,
          returned_qty: Number(di.returned_qty),
        };
      });
      return {
        delivery_id: d.delivery_id,
        order_id: d.order_id,
        delivery_date: d.delivery_date,
        delivery_slot: d.delivery_slot,
        vehicle_no: d.vehicle_no,
        delivery_person: d.delivery_person,
        status: d.status,
        notes: d.notes,
        total_amount: Number(ordersById.get(d.order_id)?.total_amount ?? 0),
        items: orderItems,
      };
    });

  return {
    shop_id: shopId,
    shop_name: shop.shop_name,
    deliveries: result,
    language_detected: languageDetected ?? null,
  };
}

export async function writeTodayNote(
  shopId: string,
  noteText: string,
  opts: {
    note_type?: string;
    source?: "AI" | "human";
    agent_role?: string | null;
  } = {}
) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!noteText?.trim()) throw new VoiceApiError(400, "note_text_required");

  const { data: shop } = await supabase
    .from("shops")
    .select("shop_id")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  const { data, error } = await supabase
    .from("today_notes")
    .insert({
      shop_id: shopId,
      note_date: todayIST(),
      note_type: opts.note_type ?? "general",
      note_text: noteText.trim(),
      source: opts.source ?? "AI",
      agent_role: opts.agent_role ?? null,
    })
    .select()
    .single();
  if (error) throw new VoiceApiError(500, "db_error", error.message);

  return {
    note_id: data.note_id,
    shop_id: data.shop_id,
    note_date: data.note_date,
    note_type: data.note_type,
    note_text: data.note_text,
    source: data.source,
    agent_role: data.agent_role,
    created_at: data.created_at,
  };
}

export async function getTodayDetails(shopId: string) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");

  const today = todayIST();

  const { data: shop } = await supabase
    .from("shops")
    .select("shop_id, shop_name, owner_name, phone_number")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  const { data: orders } = await supabase
    .from("orders")
    .select("order_id, order_date, delivery_date, delivery_slot, total_amount, order_status, confirmed_order, payment_status")
    .eq("shop_id", shopId)
    .eq("order_date", today)
    .order("created_at", { ascending: false });

  const orderIds = (orders ?? []).map((o) => o.order_id);
  const itemsById = new Map<string, Array<{ product_id: string; quantity: number; unit: string; price: number }>>();
  if (orderIds.length) {
    const { data: oi } = await supabase
      .from("order_items")
      .select("order_id, product_id, quantity, unit, price")
      .in("order_id", orderIds);
    (oi ?? []).forEach((r) => {
      const list = itemsById.get(r.order_id) ?? [];
      list.push({ product_id: r.product_id, quantity: r.quantity, unit: r.unit, price: Number(r.price) });
      itemsById.set(r.order_id, list);
    });
  }
  const productIds = [...new Set([...itemsById.values()].flatMap((list) => list.map((i) => i.product_id)))];
  const names = await resolveProductNames(productIds);

  const { data: notes } = await supabase
    .from("today_notes")
    .select("note_id, note_type, note_text, source, agent_role, created_at, note_date")
    .eq("shop_id", shopId)
    .eq("note_date", today)
    .order("created_at", { ascending: false });

  interface DeliveryRow {
    delivery_id: number;
    order_id: string;
    delivery_date: string | null;
    delivery_slot: string | null;
    vehicle_no: string | null;
    delivery_person: string | null;
    status: string;
    notes: string | null;
  }
  let deliveryRows: DeliveryRow[] = [];
  if (orderIds.length) {
    const { data } = await supabase
      .from("deliveries")
      .select("delivery_id, order_id, delivery_date, delivery_slot, vehicle_no, delivery_person, status, notes")
      .in("order_id", orderIds);
    deliveryRows = (data ?? []) as unknown as DeliveryRow[];
  }
  const deliveriesByOrder = new Map<string, DeliveryRow[]>();
  deliveryRows.forEach((d) => {
    if (!deliveriesByOrder.has(d.order_id)) deliveriesByOrder.set(d.order_id, []);
    deliveriesByOrder.get(d.order_id)!.push(d);
  });

  return {
    shop_id: shopId,
    shop_name: shop.shop_name,
    owner_name: shop.owner_name,
    date: today,
    orders: (orders ?? []).map((o) => ({
      order_id: o.order_id,
      delivery_date: o.delivery_date,
      delivery_slot: o.delivery_slot,
      total_amount: Number(o.total_amount),
      order_status: o.order_status,
      confirmed_order: o.confirmed_order,
      payment_status: o.payment_status,
      items: (itemsById.get(o.order_id) ?? []).map((i) => ({
        product_id: i.product_id,
        product_name: names.get(i.product_id) ?? i.product_id,
        quantity: i.quantity,
        unit: i.unit,
        price: i.price,
      })),
      deliveries: (deliveriesByOrder.get(o.order_id) ?? []).map((d) => ({
        delivery_id: d.delivery_id,
        delivery_date: d.delivery_date,
        delivery_slot: d.delivery_slot,
        vehicle_no: d.vehicle_no,
        delivery_person: d.delivery_person,
        status: d.status,
        notes: d.notes,
      })),
    })),
    notes: (notes ?? []).map((n) => ({
      note_id: n.note_id,
      note_type: n.note_type,
      note_text: n.note_text,
      source: n.source,
      agent_role: n.agent_role,
      created_at: n.created_at,
    })),
  };
}

// ──────────────────────────────────────────────
// Beat Scheduler
// ──────────────────────────────────────────────

export interface BeatScheduleEntry {
  route_id: string;
  route_name: string;
  beat_day: number;
  delivery_days: number;
  salesperson: string | null;
  shop_count: number;
  shops: { shop_id: string; shop_name: string; phone_number: string; opt_out: boolean }[];
}

export async function getBeatSchedule(): Promise<BeatScheduleEntry[]> {
  const { data: routes, error } = await supabase
    .from("routes")
    .select("route_id, route_name, beat_day, delivery_days, salesperson, is_active")
    .eq("is_active", true)
    .order("beat_day");
  if (error) throw new VoiceApiError(500, "db_error", error.message);

  const { data: shops } = await supabase
    .from("shops")
    .select("shop_id, shop_name, phone_number, beat_route_id, opt_out")
    .eq("opt_out", false);

  const shopsByRoute = new Map<string, typeof shops>();
  (shops ?? []).forEach((s) => {
    if (!s.beat_route_id) return;
    if (!shopsByRoute.has(s.beat_route_id)) shopsByRoute.set(s.beat_route_id, []);
    shopsByRoute.get(s.beat_route_id)!.push(s);
  });

  return (routes ?? []).map((r) => ({
    route_id: r.route_id,
    route_name: r.route_name,
    beat_day: r.beat_day,
    delivery_days: r.delivery_days,
    salesperson: r.salesperson,
    shop_count: (shopsByRoute.get(r.route_id) ?? []).length,
    shops: (shopsByRoute.get(r.route_id) ?? []).map((s) => ({
      shop_id: s.shop_id,
      shop_name: s.shop_name,
      phone_number: s.phone_number,
      opt_out: s.opt_out,
    })),
  }));
}

export interface BeatCallRecord {
  id: number;
  call_date: string;
  route_id: string;
  shop_id: string;
  status: "pending" | "calling" | "completed" | "failed" | "skipped";
  order_id: string | null;
  attempt_count: number;
  shop_name?: string;
  route_name?: string;
}

export async function getTodayBeatCalls(): Promise<BeatCallRecord[]> {
  const today = todayIST();
  const { data, error } = await supabase
    .from("beat_calls")
    .select("*, shops(shop_name), routes(route_name)")
    .eq("call_date", today)
    .order("id");
  if (error) throw new VoiceApiError(500, "db_error", error.message);

  return (data ?? []).map((r: any) => ({
    id: r.id,
    call_date: r.call_date,
    route_id: r.route_id,
    shop_id: r.shop_id,
    status: r.status,
    order_id: r.order_id,
    attempt_count: r.attempt_count,
    shop_name: r.shops?.shop_name,
    route_name: r.routes?.route_name,
  }));
}

export async function generateBeatCalls(): Promise<{ created: number; skipped: number }> {
  const today = todayIST();
  const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon...

  // Find routes scheduled for today
  const { data: routes, error: routeError } = await supabase
    .from("routes")
    .select("route_id")
    .eq("beat_day", dayOfWeek)
    .eq("is_active", true);
  if (routeError) throw new VoiceApiError(500, "db_error", routeError.message);
  if (!routes?.length) return { created: 0, skipped: 0 };

  const routeIds = routes.map((r) => r.route_id);

  // Find eligible shops on these routes
  const { data: shops, error: shopError } = await supabase
    .from("shops")
    .select("shop_id, beat_route_id")
    .in("beat_route_id", routeIds)
    .eq("opt_out", false)
    .eq("voice_consent", true);
  if (shopError) throw new VoiceApiError(500, "db_error", shopError.message);

  // Check which already have calls today
  const { data: existingCalls } = await supabase
    .from("beat_calls")
    .select("shop_id")
    .eq("call_date", today);
  const alreadyCalled = new Set((existingCalls ?? []).map((c) => c.shop_id));

  const toCreate = (shops ?? []).filter((s) => !alreadyCalled.has(s.shop_id));
  const skipped = (shops ?? []).length - toCreate.length;

  if (toCreate.length > 0) {
    const { error: insertError } = await supabase.from("beat_calls").insert(
      toCreate.map((s) => ({
        call_date: today,
        route_id: s.beat_route_id,
        shop_id: s.shop_id,
        status: "pending",
      }))
    );
    if (insertError) throw new VoiceApiError(500, "db_error", insertError.message);
  }

  return { created: toCreate.length, skipped };
}

export async function updateBeatCallStatus(
  beatCallId: number,
  status: BeatCallRecord["status"],
  orderId?: string
): Promise<void> {
  const update: Record<string, any> = {
    status,
    last_attempt_at: new Date().toISOString(),
  };
  if (orderId) update.order_id = orderId;

  const { error } = await supabase
    .from("beat_calls")
    .update(update)
    .eq("id", beatCallId);
  if (error) throw new VoiceApiError(500, "db_error", error.message);
}

// ──────────────────────────────────────────────
// Auto-Delivery
// ──────────────────────────────────────────────

export async function autoCompleteDeliveries(): Promise<{ updated: number }> {
  const today = todayIST();

  // Find confirmed orders where delivery_date <= today and not yet delivered
  const { data: orders, error: orderError } = await supabase
    .from("orders")
    .select("order_id, shop_id, total_amount, delivery_date")
    .eq("order_status", "confirmed")
    .lte("delivery_date", today);
  if (orderError) throw new VoiceApiError(500, "db_error", orderError.message);
  if (!orders?.length) return { updated: 0 };

  // Check which already have delivery records
  const orderIds = orders.map((o) => o.order_id);
  const { data: existingDeliveries } = await supabase
    .from("deliveries")
    .select("order_id")
    .in("order_id", orderIds);
  const alreadyDelivered = new Set((existingDeliveries ?? []).map((d) => d.order_id));

  const toDeliver = orders.filter((o) => !alreadyDelivered.has(o.order_id));
  let updated = 0;

  for (const order of toDeliver) {
    // Fetch order items for delivery_items
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("order_item_id, quantity")
      .eq("order_id", order.order_id);

    // Create delivery record
    const { data: delivery, error: delError } = await supabase
      .from("deliveries")
      .insert({
        order_id: order.order_id,
        delivery_date: order.delivery_date,
        delivery_slot: "2 PM - 5 PM",
        status: "completed",
        notes: "Auto-delivered by scheduler",
      })
      .select("delivery_id")
      .single();
    if (delError) {
      console.error(`Failed to create delivery for ${order.order_id}:`, delError.message);
      continue;
    }

    // Create delivery items
    if (orderItems?.length && delivery) {
      await supabase.from("delivery_items").insert(
        orderItems.map((oi) => ({
          delivery_id: delivery.delivery_id,
          order_item_id: oi.order_item_id,
          delivered_qty: oi.quantity,
          returned_qty: 0,
        }))
      );
    }

    // Update order status
    await supabase
      .from("orders")
      .update({ order_status: "delivered" })
      .eq("order_id", order.order_id);

    updated++;
  }

  return { updated };
}
