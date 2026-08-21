import {
  getConversationHistory,
  VoiceApiError,
  voiceErrorResponse,
} from "@/lib/voice/backend";
import type { AppLanguage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const callId = url.searchParams.get("call_id");
    const shopId = url.searchParams.get("shop_id");
    const languageDetected = url.searchParams.get("language_detected") as AppLanguage | null;

    if (!callId && !shopId) {
      throw new VoiceApiError(400, "call_id_or_shop_id_required");
    }

    const result = await getConversationHistory(callId, shopId, languageDetected);
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}