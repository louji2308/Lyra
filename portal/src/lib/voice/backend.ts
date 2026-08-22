import { supabase } from "@/lib/supabase";
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
  } = {}
): Promise<CreateOrderResult> {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!Array.isArray(items) || items.length === 0) {
    throw new VoiceApiError(400, "items_required");
  }

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("shop_id, shop_name, preferred_language")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (shopError) throw new VoiceApiError(500, "db_error", shopError.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

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
  const today = new Date().toISOString().slice(0, 10);
  const deliveryDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
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
  return data;
}

export async function saveComplaint(
  shopId: string,
  complaintType: ComplaintType,
  description: string | null,
  opts: { severity?: Severity; callback_requested?: boolean } = {}
) {
  if (!shopId) throw new VoiceApiError(400, "shop_id_required");
  if (!complaintType) throw new VoiceApiError(400, "complaint_type_required");

  const { data, error } = await supabase
    .from("complaints")
    .insert({
      shop_id: shopId,
      complaint_type: complaintType,
      description: description?.trim() || null,
      severity: opts.severity ?? "medium",
      status: "open",
      callback_requested: opts.callback_requested ?? false,
    })
    .select()
    .single();
  if (error) throw new VoiceApiError(500, "db_error", error.message);
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

export interface SendWhatsAppResult {
  shop_id: string;
  order_id: string;
  whatsapp_sent: boolean;
  message_preview: string;
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

  await supabase
    .from("call_logs")
    .update({ whatsapp_sent: true })
    .eq("order_id", orderId);

  return {
    shop_id: shopId,
    order_id: orderId,
    whatsapp_sent: true,
    message_preview: msg.slice(0, 200),
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

  const { data, error } = await supabase
    .from("returns")
    .insert({
      shop_id: shopId,
      order_id: orderId ?? null,
      product_id: productId,
      quantity,
      reason: reason?.trim() || null,
      credit_note_amount: creditNote,
      status: "requested" as ReturnStatus,
    })
    .select()
    .single();
  if (error) throw new VoiceApiError(500, "db_error", error.message);

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
  let targetCallId = callId;

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

  let turns: ConversationTurn[] = [];

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
  },
  languageDetected?: AppLanguage | null
): Promise<CreateShopResult> {
  const { phone_number, shop_name, owner_name, area, preferred_language } = input;

  const digits = normalizePhone(phone_number);
  if (!digits) throw new VoiceApiError(400, "phone_required");
  if (!shop_name?.trim()) throw new VoiceApiError(400, "shop_name_required");
  if (!owner_name?.trim()) throw new VoiceApiError(400, "owner_name_required");
  if (!area?.trim()) throw new VoiceApiError(400, "area_required");

  const validLanguages = ["tanglish", "tamil", "hindi", "english"];
  const lang = validLanguages.includes(preferred_language.toLowerCase()) ? preferred_language.toLowerCase() : "tanglish";

  // Check if shop already exists with this phone
  const { data: existing } = await supabase
    .from("shops")
    .select("shop_id")
    .ilike("phone_number", `%${digits.slice(-10)}`)
    .maybeSingle();
  if (existing) throw new VoiceApiError(409, "shop_already_exists");

  // Get default route (R001)
  const { data: route } = await supabase
    .from("routes")
    .select("route_id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const routeId = route?.route_id ?? "R001";

  const { data, error } = await supabase
    .from("shops")
    .insert({
      shop_id: `S${Date.now().toString().slice(-3)}`,
      shop_name: shop_name.trim(),
      owner_name: owner_name.trim(),
      phone_number: digits,
      whatsapp_number: digits,
      preferred_language: lang,
      preferred_call_start: "09:00",
      preferred_call_end: "18:00",
      beat_route_id: routeId,
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
