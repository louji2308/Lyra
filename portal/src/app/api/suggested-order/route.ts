import {
  getSuggestedOrder,
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
    if (!shopId) throw new VoiceApiError(400, "shop_id_required");
    return Response.json(await getSuggestedOrder(shopId, languageDetected));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
