import { supabase } from "@/lib/supabase";
import { formatOrderConfirmation, type OrderConfirmationData } from "@/lib/voice/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shop_id, order_id } = body;

    if (!shop_id || !order_id) {
      return Response.json({ error: "shop_id and order_id required" }, { status: 400 });
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

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("order_id, total_amount, delivery_date, delivery_slot, payment_status")
      .eq("order_id", order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return Response.json({ error: "order_not_found" }, { status: 404 });

    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, quantity, unit, price, line_total")
      .eq("order_id", order_id);

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

    const paymentStatus = order.payment_status === "paid" ? "credit" :
      order.payment_status === "partial" ? "partial" : "upi_link_sent";

    const data: OrderConfirmationData = {
      shop_name: shop.shop_name,
      order_id: order.order_id,
      items: formattedItems,
      total: Number(order.total_amount),
      payment_status: paymentStatus,
      delivery_date: order.delivery_date,
      delivery_slot: order.delivery_slot,
    };

    const message = formatOrderConfirmation(data);

    await supabase
      .from("call_logs")
      .update({ whatsapp_sent: true })
      .eq("order_id", order_id);

    return Response.json({
      success: true,
      shop_id,
      order_id,
      message_preview: message.slice(0, 300),
      whatsapp_number: shop.whatsapp_number,
    });
  } catch (err: unknown) {
    console.error("[whatsapp/confirm] error:", err);
    return Response.json({ error: "internal_error", detail: String(err) }, { status: 500 });
  }
}