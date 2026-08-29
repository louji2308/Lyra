import { updateShop, applyShopUpdate, VoiceApiError } from "@/lib/voice/backend";
import { voiceErrorResponse } from "@/lib/voice/backend";

export const dynamic = "force-dynamic";

// update_shop — confirm-first: first call returns a draft; apply only when
// confirmed=true is passed (Reception reads back and the owner confirms).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shop_id, confirmed, shop_name, owner_name, preferred_language, preferred_call_start, preferred_call_end, beat_route_id } = body;
    if (!shop_id) throw new VoiceApiError(400, "shop_id_required");

    if (confirmed === true) {
      const result = await applyShopUpdate(String(shop_id), true, {
        shop_name,
        owner_name,
        preferred_language,
        preferred_call_start,
        preferred_call_end,
        beat_route_id,
      });
      return Response.json(result);
    }

    const result = await updateShop(String(shop_id), {
      shop_name,
      owner_name,
      preferred_language,
      preferred_call_start,
      preferred_call_end,
      beat_route_id,
    });
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
