import { getTodayDetails, VoiceApiError } from "@/lib/voice/backend";
import { voiceErrorResponse } from "@/lib/voice/backend";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const shopId = url.searchParams.get("shop_id");
    if (!shopId) throw new VoiceApiError(400, "shop_id_required");
    const result = await getTodayDetails(shopId);
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
