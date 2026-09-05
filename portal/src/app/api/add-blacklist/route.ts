import { addBlacklistEntry, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    if (!params.shop_id) throw new VoiceApiError(400, "shop_id_required");
    if (!params.product_id) throw new VoiceApiError(400, "product_id_required");
    return Response.json(
      await addBlacklistEntry(params.shop_id, params.product_id, params.reason ?? null),
      { status: 201 }
    );
  } catch (err) {
    return voiceErrorResponse(err);
  }
}