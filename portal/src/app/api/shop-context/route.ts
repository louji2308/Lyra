import {
  getShopContext,
  identifyShopByPhone,
  VoiceApiError,
  voiceErrorResponse,
} from "@/lib/voice/backend";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const shopId = url.searchParams.get("shop_id");
    if (shopId) {
      return Response.json(await getShopContext(shopId));
    }
    const phone = url.searchParams.get("phone");
    if (!phone) throw new VoiceApiError(400, "phone_or_shop_id_required");
    const shop = await identifyShopByPhone(phone);
    return Response.json(await getShopContext(shop.shop_id));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
