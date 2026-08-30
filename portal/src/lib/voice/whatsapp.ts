import { supabase } from "@/lib/supabase";
import type { AppLanguage } from "@/lib/types";

export type WhatsAppMessageType =
  | "order_confirmation"
  | "payment_link"
  | "available_schemes"
  | "delivery_update"
  | "return_photo_request"
  | "monthly_statement";

export interface WhatsAppPayload {
  to: string;
  type: WhatsAppMessageType;
  data: Record<string, unknown>;
}

// Build a wa.me deep link (tap-to-send) for a WhatsApp number + pre-filled text.
// Free, no provider, works with any WhatsApp number — used until a paid sender
// (Twilio / Meta Cloud API) is wired in. Numbers are assumed Indian (+91).
export function buildWhatsAppWaLink(to: string, message: string): string {
  let digits = (to || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = "91" + digits.slice(1);
  if (!digits.startsWith("91")) digits = "91" + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export interface OrderConfirmationData {
  shop_name: string;
  order_id: string;
  items: { name: string; qty: number; unit: string; line_total: number }[];
  total: number;
  payment_status: "credit" | "partial" | "upi_link_sent";
  upi_link?: string;
  delivery_date?: string;
  delivery_slot?: string;
}

export interface PaymentLinkData {
  shop_name: string;
  order_id: string;
  amount_due: number;
  upi_link: string;
  reason: "credit_exceeded" | "high_value_order";
}

export interface AvailableSchemesData {
  shop_name: string;
  schemes: {
    name: string;
    benefit: string;
    eligible_products: string[];
    min_qty: number;
    valid_until?: string;
  }[];
}

export interface DeliveryUpdateData {
  shop_name: string;
  order_id: string;
  vehicle_no: string;
  driver_name: string;
  driver_phone: string;
  eta: string;
  items: string[];
}

export interface ReturnPhotoRequestData {
  shop_name: string;
  return_id: number;
  product_name: string;
  quantity: number;
  reason: string;
}

export interface MonthlyStatementData {
  shop_name: string;
  period: string;
  outstanding: number;
  credit_limit: number;
  available_credit: number;
  recent_orders: { id: string; date: string; amount: number }[];
  payments: { date: string; amount: number; method: string }[];
}

export function formatOrderConfirmation(data: OrderConfirmationData): string {
  const lines = data.items.map(
    (i) => `${i.qty} ${i.unit} ${i.name} — ₹${i.line_total}`
  );
  let msg = `Shree Agencies — Order Confirmation\n`;
  msg += `Order: ${data.order_id}\n`;
  msg += `Shop: ${data.shop_name}\n\n`;
  msg += `Items:\n${lines.join("\n")}\n\n`;
  msg += `Total: ₹${data.total}\n`;
  msg += `Payment: ${data.payment_status === "credit" ? "Credit" : data.payment_status === "partial" ? `Partial (₹${data.upi_link ? "UPI link sent" : "pending"})` : "UPI link sent"}\n`;
  if (data.delivery_date) {
    msg += `Delivery: ${data.delivery_date}${data.delivery_slot ? `, ${data.delivery_slot}` : ""}\n`;
  }
  msg += `\nReply: CONFIRM / EDIT / CANCEL`;
  return msg;
}

export function formatPaymentLink(data: PaymentLinkData): string {
  let msg = `Shree Agencies — Payment Required\n`;
  msg += `Shop: ${data.shop_name}\n`;
  msg += `Order: ${data.order_id}\n`;
  msg += `Amount Due: ₹${data.amount_due}\n`;
  msg += `Reason: ${data.reason === "credit_exceeded" ? "Credit limit exceeded" : "High-value order requires payment"}\n\n`;
  msg += `Pay here: ${data.upi_link}\n\n`;
  msg += `Order will be confirmed after payment.`;
  return msg;
}

export function formatAvailableSchemes(data: AvailableSchemesData): string {
  if (!data.schemes.length) {
    return `Hi ${data.shop_name}! No active schemes currently.`;
  }
  let msg = `Shree Agencies — Active Schemes for ${data.shop_name}\n\n`;
  data.schemes.forEach((s, i) => {
    msg += `${i + 1}. ${s.name}\n`;
    msg += `   Benefit: ${s.benefit}\n`;
    msg += `   Min Qty: ${s.min_qty}\n`;
    if (s.valid_until) msg += `   Valid until: ${s.valid_until}\n`;
    msg += `   Products: ${s.eligible_products.join(", ")}\n\n`;
  });
  msg += `Reply with scheme number to apply, or ask Lyra on call.`;
  return msg;
}

export function formatDeliveryUpdate(data: DeliveryUpdateData): string {
  let msg = `Shree Agencies — Delivery Update\n`;
  msg += `Order: ${data.order_id}\n`;
  msg += `Out for delivery!\n\n`;
  msg += `Vehicle: ${data.vehicle_no}\n`;
  msg += `Driver: ${data.driver_name} (${data.driver_phone})\n`;
  msg += `ETA: ${data.eta}\n\n`;
  msg += `Items:\n${data.items.map((i) => `• ${i}`).join("\n")}\n\n`;
  msg += `Please ensure someone is available to receive.`;
  return msg;
}

export function formatReturnPhotoRequest(data: ReturnPhotoRequestData): string {
  let msg = `Shree Agencies — Return Photo Required\n`;
  msg += `Shop: ${data.shop_name}\n`;
  msg += `Return ID: ${data.return_id}\n`;
  msg += `Product: ${data.product_name} x${data.quantity}\n`;
  msg += `Reason: ${data.reason}\n\n`;
  msg += `Please send a clear photo of the items on this WhatsApp chat.\n`;
  msg += `We'll process the credit note once received.`;
  return msg;
}

export function formatMonthlyStatement(data: MonthlyStatementData): string {
  let msg = `Shree Agencies — Monthly Statement (${data.period})\n`;
  msg += `Shop: ${data.shop_name}\n\n`;
  msg += `Credit Summary:\n`;
  msg += `  Limit: ₹${data.credit_limit}\n`;
  msg += `  Outstanding: ₹${data.outstanding}\n`;
  msg += `  Available: ₹${data.available_credit}\n\n`;
  msg += `Recent Orders:\n`;
  data.recent_orders.forEach((o) => {
    msg += `  ${o.date} — ${o.id} — ₹${o.amount}\n`;
  });
  msg += `\nPayments Received:\n`;
  data.payments.forEach((p) => {
    msg += `  ${p.date} — ₹${p.amount} (${p.method})\n`;
  });
  msg += `\nReply PAY to make a payment, or call Lyra.`;
  return msg;
}

export async function getActiveSchemesForShop(shopId: string): Promise<AvailableSchemesData["schemes"]> {
  const { data: schemes, error } = await supabase
    .from("schemes")
    .select("scheme_id, scheme_name, start_date, end_date, eligible_product_ids, minimum_quantity, benefit_type, benefit_value")
    .eq("is_active", true)
    .lte("start_date", new Date().toISOString().split("T")[0])
    .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split("T")[0]}`)
    .order("start_date", { ascending: false });

  if (error || !schemes) return [];

  const productNames = await resolveProductNames(
    [...new Set(schemes.flatMap((s) => s.eligible_product_ids ?? []))]
  );

  return schemes.map((s) => ({
    name: s.scheme_name,
    benefit: formatBenefit(s.benefit_type, s.benefit_value),
    eligible_products: (s.eligible_product_ids ?? []).map((p: string) => productNames.get(p) ?? p),
    min_qty: Number(s.minimum_quantity ?? 1),
    valid_until: s.end_date ? new Date(s.end_date).toLocaleDateString() : undefined,
  }));
}

function formatBenefit(type: string, value: number): string {
  switch (type) {
    case "discount":
      return `${value}% off`;
    case "free_units":
      return `Buy ${value} get 1 free`;
    case "cashback":
      return `₹${value} cashback`;
    default:
      return `${value} ${type}`;
  }
}

async function resolveProductNames(productIds: string[]): Promise<Map<string, string>> {
  if (!productIds.length) return new Map();
  const { data } = await supabase
    .from("products")
    .select("product_id, product_name")
    .in("product_id", productIds);
  const map = new Map<string, string>();
  data?.forEach((p) => map.set(p.product_id, p.product_name));
  return map;
}