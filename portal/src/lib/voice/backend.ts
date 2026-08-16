import { supabase } from "@/lib/supabase";
import type {
  AppLanguage,
  ComplaintType,
  MemoryType,
  OrderStatus,
  PaymentStatus,
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
  owner_name: string | null;
  language: AppLanguage;
  preferred_call_time: string | null;
  credit_limit: number;
  outstanding_balance: number;
  available_credit: number;
  opt_out: boolean;
  blacklist: BlacklistItem[];
  last_order: LastOrderItem[];
}

export interface SuggestedOrderResult {
  shop_id: string;
  shop_name: string;
  repeat_order: LastOrderItem[];
  missing_categories: string[];
  new_product: { product_id: string; product_name: string; price: number } | null;
}

export interface CheckStockResult {
  product_id: string;
  product_name: string;
  unit_type: string;
  available_qty: number;
  requested_qty: number | null;
  available: boolean;
  low_stock: boolean;
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

export async function getShopContext(shopId: string): Promise<ShopContextResult> {
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

    const blacklistRows = (blacklist as unknown as Array<{
      product_id: string;
      reason: string | null;
      products: Array<{ product_id: string; product_name: string }> | { product_id: string; product_name: string } | null;
    }> | null) ?? [];

    return {
      shop_id: shop.shop_id,
      shop_name: shop.shop_name,
      owner_name: shop.owner_name,
      language: shop.preferred_language as AppLanguage,
      preferred_call_time: preferredCallTime,
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

  const ids = rows.map((r) => r.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("product_id, product_name")
    .in("product_id", ids);
  if (productsError) throw new VoiceApiError(500, "db_error", productsError.message);
  const names = new Map((products ?? []).map((p) => [p.product_id, p.product_name]));

  return rows.map((r) => ({
    product_id: r.product_id,
    product_name: names.get(r.product_id) ?? r.product_id,
    quantity: Number(r.quantity),
    unit: r.unit,
    price: Number(r.price),
  }));
}

export async function getSuggestedOrder(shopId: string): Promise<SuggestedOrderResult> {
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("shop_id, shop_name")
    .eq("shop_id", shopId)
    .maybeSingle();
  if (shopError) throw new VoiceApiError(500, "db_error", shopError.message);
  if (!shop) throw new VoiceApiError(404, "shop_not_found");

  const repeatOrder = await fetchLatestOrderItems(shopId);

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
  return data;
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
  return data;
}
