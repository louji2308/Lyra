import { deleteBlacklistEntry, removeBlacklistByProduct, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    if (params.blacklist_id) {
      return Response.json(await deleteBlacklistEntry(Number(params.blacklist_id)));
    }
    if (!params.shop_id || !params.product_id) {
      throw new VoiceApiError(400, "shop_id_and_product_id_or_blacklist_id_required");
    }
    return Response.json(await removeBlacklistByProduct(params.shop_id, params.product_id));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}