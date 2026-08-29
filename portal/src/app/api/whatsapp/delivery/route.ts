import { supabase } from "@/lib/supabase";
import { formatDeliveryUpdate, type DeliveryUpdateData } from "@/lib/voice/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { delivery_id } = body;

    if (!delivery_id) {
      return Response.json({ error: "delivery_id required" }, { status: 400 });
    }

    const { data: delivery, error: deliveryError } = await supabase
      .from("delivery_summary")
      .select("*")
      .eq("delivery_id", delivery_id)
      .maybeSingle();
    if (deliveryError) throw deliveryError;
    if (!delivery) return Response.json({ error: "delivery_not_found" }, { status: 404 });

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("shop_id, shop_name, whatsapp_number, whatsapp_consent")
      .eq("shop_id", delivery.shop_id)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return Response.json({ error: "shop_not_found" }, { status: 404 });
    if (!shop.whatsapp_consent) return Response.json({ error: "whatsapp_not_consented" }, { status: 400 });
    if (!shop.whatsapp_number) return Response.json({ error: "no_whatsapp_number" }, { status: 400 });

    const { data: items } = await supabase
      .from("delivery_items")
      .select("delivered_qty, order_items(product_id, products(product_name))")
      .eq("delivery_id", delivery_id);

    const itemStrings = (items ?? []).map((i: any) => {
      const oi = Array.isArray(i.order_items) ? i.order_items[0] : i.order_items;
      const name = oi?.products?.[0]?.product_name ?? oi?.product_id ?? "Item";
      return `${i.delivered_qty} x ${name}`;
    });

    const data: DeliveryUpdateData = {
      shop_name: shop.shop_name,
      order_id: delivery.order_id,
      vehicle_no: delivery.vehicle_no ?? "TBA",
      driver_name: delivery.delivery_person ?? "TBA",
      driver_phone: "TBA",
      eta: delivery.delivery_slot ? `${delivery.delivery_date} ${delivery.delivery_slot}` : delivery.delivery_date,
      items: itemStrings,
    };

    const message = formatDeliveryUpdate(data);

    return Response.json({
      success: true,
      delivery_id,
      shop_id: shop.shop_id,
      message_preview: message.slice(0, 300),
      whatsapp_number: shop.whatsapp_number,
    });
  } catch (err: unknown) {
    console.error("[whatsapp/delivery] error:", err);
    return Response.json({ error: "internal_error", detail: String(err) }, { status: 500 });
  }
}