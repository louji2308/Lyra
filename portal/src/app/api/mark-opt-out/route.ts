import { markOptOut, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    if (!params.shop_id) throw new VoiceApiError(400, "shop_id_required");
    return Response.json(await markOptOut(params.shop_id));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
