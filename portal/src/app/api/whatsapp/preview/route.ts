import { supabase } from "@/lib/supabase";
import {
  buildWhatsAppWaLink,
  formatOrderConfirmation,
  type OrderConfirmationData,
} from "@/lib/voice/whatsapp";
import { LYRA_COLLECTION_UPI_ID } from "@/lib/voice/backend";

export const dynamic = "force-dynamic";

// Read-only wa.me deep-link generator for the portal's "Send on WhatsApp"
// button. No side effects — never creates, never mutates. kind="order" sends
// the confirmation summary; kind="payment" sends the UPI payment request.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { order_id, kind = "order" } = body;
    if (!order_id) {
      return Response.json({ error: "order_id_required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("order_id, shop_id, total_amount, delivery_date, delivery_slot, payment_status")
      .eq("order_id", order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return Response.json({ error: "order_not_found" }, { status: 404 });

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("shop_id, shop_name, whatsapp_number, whatsapp_consent")
      .eq("shop_id", order.shop_id)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop || !shop.whatsapp_number) {
      return Response.json({ error: "no_whatsapp_number" }, { status: 404 });
    }
    if (!shop.whatsapp_consent) {
      return Response.json({ error: "whatsapp_not_consented" }, { status: 400 });
    }

    let message: string;
    if (kind === "payment") {
      const { data: credit } = await supabase
        .from("shop_credit")
        .select("credit_limit, outstanding_balance, available_credit")
        .eq("shop_id", shop.shop_id)
        .maybeSingle();
      const creditLimit = Number(credit?.credit_limit ?? 0);
      const outstanding = Number(credit?.outstanding_balance ?? 0);
      const available = Number(credit?.available_credit ?? 0);
      message =
        `Shree Agencies — Payment Required\n` +
        `Shop: ${shop.shop_name}\n` +
        `Order: ${order.order_id}\n\n` +
        `Order Total: ₹${Number(order.total_amount).toFixed(2)}\n` +
        `Credit Limit: ₹${creditLimit.toFixed(2)}\n` +
        `Already Used: ₹${outstanding.toFixed(2)}\n` +
        `Available Credit: ₹${available.toFixed(2)}\n` +
        `Amount to Pay: ₹${Number(order.total_amount).toFixed(2)}\n\n` +
        `Please pay ${Number(order.total_amount).toFixed(2)} to:\n` +
        `UPI ID: ${LYRA_COLLECTION_UPI_ID}\n\n` +
        `Your order will be confirmed once the office records your payment.`;
    } else {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, quantity, unit, price, line_total")
        .eq("order_id", order.order_id);
      const { data: products } = await supabase
        .from("products")
        .select("product_id, product_name")
        .in("product_id", items?.map((i) => i.product_id) ?? []);
      const nameMap = new Map(products?.map((p) => [p.product_id, p.product_name]) ?? []);
      const formattedItems = (items ?? []).map((i) => ({
        name: nameMap.get(i.product_id) ?? i.product_id,
        qty: Number(i.quantity),
        unit: i.unit,
        line_total: Number(i.line_total),
      }));
      const data: OrderConfirmationData = {
        shop_name: shop.shop_name,
        order_id: order.order_id,
        items: formattedItems,
        total: Number(order.total_amount),
        payment_status: order.payment_status === "paid" ? "credit" : "upi_link_sent",
        delivery_date: order.delivery_date,
        delivery_slot: order.delivery_slot,
      };
      message = formatOrderConfirmation(data);
    }

    return Response.json({
      success: true,
      shop_id: shop.shop_id,
      order_id,
      kind,
      message_preview: message.slice(0, 300),
      whatsapp_number: shop.whatsapp_number,
      wa_link: buildWhatsAppWaLink(shop.whatsapp_number, message),
    });
  } catch (err: unknown) {
    console.error("[whatsapp/preview] error:", err);
    return Response.json({ error: "internal_error", detail: String(err) }, { status: 500 });
  }
}