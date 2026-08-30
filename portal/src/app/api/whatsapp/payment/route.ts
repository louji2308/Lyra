import { supabase } from "@/lib/supabase";
import { buildWhatsAppWaLink } from "@/lib/voice/whatsapp";
import { LYRA_COLLECTION_UPI_ID } from "@/lib/voice/backend";

export const dynamic = "force-dynamic";

// send_payment_upi — when an order exceeds the shop's credit limit, builds a
// WhatsApp (preview) to the owner with the order total, their credit details,
// and Lyra's / Shree Agencies' collection UPI ID (9042113132@fam) to pay into.
// The order is left pending; a human confirms it in the portal after payment.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shop_id, order_id, amount_due, reason } = body;

    if (!shop_id || !order_id || !amount_due) {
      return Response.json({ error: "shop_id, order_id, amount_due required" }, { status: 400 });
    }

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("shop_id, shop_name, whatsapp_number, whatsapp_consent")
      .eq("shop_id", shop_id)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return Response.json({ error: "shop_not_found" }, { status: 404 });
    if (!shop.whatsapp_consent) return Response.json({ error: "whatsapp_not_consented" }, { status: 400 });
    if (!shop.whatsapp_number) return Response.json({ error: "no_whatsapp_number" }, { status: 400 });

    const { data: credit } = await supabase
      .from("shop_credit")
      .select("credit_limit, outstanding_balance, available_credit")
      .eq("shop_id", shop_id)
      .maybeSingle();

    const { data: order } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("order_id", order_id)
      .maybeSingle();

    const orderTotal = order ? Number(order.total_amount) : Number(amount_due);
    const creditLimit = Number(credit?.credit_limit ?? 0);
    const available = Number(credit?.available_credit ?? 0);
    const outstanding = Number(credit?.outstanding_balance ?? 0);

    const message =
      `Shree Agencies — Payment Required\n` +
      `Shop: ${shop.shop_name}\n` +
      `Order: ${order_id}\n\n` +
      `Order Total: ₹${orderTotal.toFixed(2)}\n` +
      `Credit Limit: ₹${creditLimit.toFixed(2)}\n` +
      `Already Used: ₹${outstanding.toFixed(2)}\n` +
      `Available Credit: ₹${available.toFixed(2)}\n` +
      `Amount to Pay: ₹${amount_due.toFixed(2)}\n\n` +
      `Please pay ${amount_due.toFixed(2)} to:\n` +
      `UPI ID: ${LYRA_COLLECTION_UPI_ID}\n\n` +
      `Your order will be confirmed once the office records your payment.`;

    // Mark the order pending with an over-credit reason (stays out of Today's
    // Orders until a human confirms after payment is recorded).
    await supabase
      .from("orders")
      .update({ pending_reason: "over_credit", order_status: "payment_pending" })
      .eq("order_id", order_id);

    return Response.json({
      success: true,
      shop_id,
      order_id,
      message_preview: message.slice(0, 400),
      whatsapp_number: shop.whatsapp_number,
      wa_link: buildWhatsAppWaLink(shop.whatsapp_number, message),
      upi_id: LYRA_COLLECTION_UPI_ID,
    });
  } catch (err: unknown) {
    console.error("[whatsapp/payment] error:", err);
    return Response.json({ error: "internal_error", detail: String(err) }, { status: 500 });
  }
}
