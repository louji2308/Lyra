import type { AppLanguage, MemoryType, OrderStatus, PaymentStatus, ReturnStatus } from "@/lib/types";
import type { RepeatItem } from "./types";

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

export interface ShopContextPayload {
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

export interface SuggestedOrderPayload {
  shop_id: string;
  shop_name: string;
  repeat_order: RepeatItem[];
  missing_categories: string[];
  new_product: { product_id: string; product_name: string; price: number } | null;
}

export interface CheckStockPayload {
  product_id: string;
  product_name: string;
  unit_type: string;
  available_qty: number;
  requested_qty: number | null;
  available: boolean;
  low_stock: boolean;
}

export interface CheckCreditPayload {
  shop_id: string;
  shop_name: string;
  credit_limit: number;
  outstanding_balance: number;
  available_credit: number;
  order_total: number;
  approved: boolean;
  extra_payment_needed: number;
}

export interface CreatedOrderPayload {
  order_id: string;
  shop_id: string;
  shop_name: string;
  total_amount: number;
  credit_used: number;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit: string;
    price: number;
    line_total: number;
  }[];
}

export interface SavedMemoryPayload {
  memory_id: number;
  shop_id: string;
  memory_text: string;
  memory_type: MemoryType;
  confidence_score: number;
  confirmed_by_user: boolean;
  created_at: string;
}

export interface SavedComplaintPayload {
  complaint_id: number;
  shop_id: string;
  complaint_type: string;
  description: string | null;
  severity: string;
  status: string;
  callback_requested: boolean;
  created_at: string;
}

export interface OptOutPayload {
  shop_id: string;
  shop_name: string;
  opt_out: boolean;
  voice_consent: boolean;
}

export interface CheckBlacklistPayload {
  shop_id: string;
  product_id: string;
  is_blacklisted: boolean;
  reason: string | null;
}

export interface SendWhatsAppPayload {
  shop_id: string;
  order_id: string;
  whatsapp_sent: boolean;
  message_preview: string;
}

export interface CreateReturnPayload {
  return_id: number;
  shop_id: string;
  order_id: string | null;
  product_id: string | null;
  quantity: number;
  reason: string | null;
  status: ReturnStatus;
}

export interface SchemePayload {
  scheme_id: string;
  scheme_name: string;
  benefit_type: string;
  benefit_value: number;
  eligible_product_ids: string[];
  is_active: boolean;
}

async function req<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `request_failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return req<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export const voiceApi = {
  identifyShopByPhone: (phone: string) =>
    req<ShopContextPayload>(`/api/shop-context?phone=${encodeURIComponent(phone)}`),

  getShopContext: (shopId: string) =>
    req<ShopContextPayload>(`/api/shop-context?shop_id=${encodeURIComponent(shopId)}`),

  getSuggestedOrder: (shopId: string) =>
    req<SuggestedOrderPayload>(`/api/suggested-order?shop_id=${encodeURIComponent(shopId)}`),

  checkStock: (body: { product_id: string; quantity?: number }) =>
    post<CheckStockPayload>("/api/check-stock", body),

  checkCredit: (body: { shop_id: string; order_total: number }) =>
    post<CheckCreditPayload>("/api/check-credit", body),

  createOrder: (body: {
    shop_id: string;
    items: { product_id: string; quantity: number }[];
    payment_status?: PaymentStatus;
    order_status?: OrderStatus;
    transcript_summary?: string;
    language_detected?: AppLanguage | null;
  }) => post<CreatedOrderPayload>("/api/create-order", body),

  saveMemory: (body: {
    shop_id: string;
    memory_text: string;
    memory_type: MemoryType;
    confirmed_by_user?: boolean;
    confidence_score?: number;
  }) => post<SavedMemoryPayload>("/api/save-memory", body),

  saveComplaint: (body: {
    shop_id: string;
    complaint_type: string;
    description?: string;
    callback_requested?: boolean;
  }) => post<SavedComplaintPayload>("/api/save-complaint", body),

  markOptOut: (shopId: string) =>
    post<OptOutPayload>("/api/mark-opt-out", { shop_id: shopId }),

  checkBlacklist: (body: { shop_id: string; product_id: string }) =>
    post<CheckBlacklistPayload>("/api/check-blacklist", body),

  sendWhatsApp: (body: { shop_id: string; order_id: string }) =>
    post<SendWhatsAppPayload>("/api/send-whatsapp", body),

  createReturn: (body: {
    shop_id: string;
    product_id: string;
    quantity: number;
    reason?: string;
    order_id?: string;
  }) => post<CreateReturnPayload>("/api/create-return", body),

  getSchemes: () => req<SchemePayload[]>("/api/schemes"),
};
