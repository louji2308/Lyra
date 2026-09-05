import {
  getShopContext,
  identifyShopByAnyPhone,
  VoiceApiError,
  voiceErrorResponse,
} from "@/lib/voice/backend";
import type { AppLanguage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const shopId = url.searchParams.get("shop_id");
    const languageDetected = url.searchParams.get("language_detected") as AppLanguage | null;

    if (shopId) {
      return Response.json(await getShopContext(shopId, languageDetected));
    }
    const rawPhone = url.searchParams.get("phone");
    const rawPhoneNumber = url.searchParams.get("phone_number");
    // Prefer phone_number if phone looks like an unresolved template variable
    const phone = (rawPhone && rawPhone.includes("{{")) ? rawPhoneNumber : (rawPhone ?? rawPhoneNumber);
    console.log("[shop-context GET] phone_received:", phone, "url:", request.url);
    if (!phone) throw new VoiceApiError(400, "phone_or_shop_id_required");
    const shop = await identifyShopByAnyPhone(phone);
    return Response.json(await getShopContext(shop.shop_id));
  } catch (err) {
    if (err instanceof VoiceApiError && err.code === "shop_not_found" && err.detail === "new_shop") {
      return Response.json({ found: false, reason: "new_shop" }, { status: 404 });
    }
    return voiceErrorResponse(err);
  }
}

// identify_shop_by_phone (SnapServe) — resolve ANY phone (primary or added)
// to a shop. Returns the shop identity; 404 carries detail "new_shop" so the
// Reception agent knows to onboard.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawPhone = body?.phone;
    const rawPhoneNumber = body?.phone_number;
    const phone = (rawPhone && String(rawPhone).includes("{{")) ? rawPhoneNumber : (rawPhone ?? rawPhoneNumber);
    console.log("[shop-context POST] phone_received:", phone);
    if (!phone) throw new VoiceApiError(400, "phone_required");
    const shop = await identifyShopByAnyPhone(String(phone));
    return Response.json({ found: true, shop });
  } catch (err) {
    if (err instanceof VoiceApiError && err.code === "shop_not_found" && err.detail === "new_shop") {
      return Response.json({ found: false, reason: "new_shop" }, { status: 404 });
    }
    return voiceErrorResponse(err);
  }
}
