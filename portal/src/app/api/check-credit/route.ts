import { checkCredit, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    const shop_id = params.shop_id;
    if (!shop_id) throw new VoiceApiError(400, "shop_id_required");
    if (params.order_total == null) throw new VoiceApiError(400, "order_total_required");
    return Response.json(await checkCredit(shop_id, Number(params.order_total)));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
