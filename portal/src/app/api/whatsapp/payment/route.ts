import { supabase } from "@/lib/supabase";
import { formatPaymentLink, type PaymentLinkData } from "@/lib/voice/whatsapp";

export const dynamic = "force-dynamic";

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

    const upiLink = `upi://pay?pa=shreeagencies@upi&pn=Shree%20Agencies&am=${amount_due}&cu=INR&tn=Order%20${order_id}`;

    const data: PaymentLinkData = {
      shop_name: shop.shop_name,
      order_id,
      amount_due: Number(amount_due),
      upi_link: upiLink,
      reason: reason === "high_value_order" ? "high_value_order" : "credit_exceeded",
    };

    const message = formatPaymentLink(data);

    return Response.json({
      success: true,
      shop_id,
      order_id,
      message_preview: message.slice(0, 300),
      whatsapp_number: shop.whatsapp_number,
      upi_link: upiLink,
    });
  } catch (err: unknown) {
    console.error("[whatsapp/payment] error:", err);
    return Response.json({ error: "internal_error", detail: String(err) }, { status: 500 });
  }
}