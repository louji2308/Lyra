import {
  getSuggestedOrder,
  VoiceApiError,
  voiceErrorResponse,
} from "@/lib/voice/backend";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const shopId = url.searchParams.get("shop_id");
    if (!shopId) throw new VoiceApiError(400, "shop_id_required");
    return Response.json(await getSuggestedOrder(shopId));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
