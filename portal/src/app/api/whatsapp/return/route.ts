import { supabase } from "@/lib/supabase";
import { formatReturnPhotoRequest, type ReturnPhotoRequestData } from "@/lib/voice/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { return_id } = body;

    if (!return_id) {
      return Response.json({ error: "return_id required" }, { status: 400 });
    }

    const { data: returnRecord, error: returnError } = await supabase
      .from("returns")
      .select("*, products(product_name)")
      .eq("return_id", return_id)
      .maybeSingle();
    if (returnError) throw returnError;
    if (!returnRecord) return Response.json({ error: "return_not_found" }, { status: 404 });

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("shop_id, shop_name, whatsapp_number, whatsapp_consent")
      .eq("shop_id", returnRecord.shop_id)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return Response.json({ error: "shop_not_found" }, { status: 404 });
    if (!shop.whatsapp_consent) return Response.json({ error: "whatsapp_not_consented" }, { status: 400 });
    if (!shop.whatsapp_number) return Response.json({ error: "no_whatsapp_number" }, { status: 400 });

    const data: ReturnPhotoRequestData = {
      shop_name: shop.shop_name,
      return_id: returnRecord.return_id,
      product_name: returnRecord.products?.product_name ?? returnRecord.product_id ?? "Item",
      quantity: Number(returnRecord.quantity),
      reason: returnRecord.reason ?? "Not specified",
    };

    const message = formatReturnPhotoRequest(data);

    return Response.json({
      success: true,
      return_id,
      shop_id: shop.shop_id,
      message_preview: message.slice(0, 300),
      whatsapp_number: shop.whatsapp_number,
    });
  } catch (err: unknown) {
    console.error("[whatsapp/return] error:", err);
    return Response.json({ error: "internal_error", detail: String(err) }, { status: 500 });
  }
}