import { addShopPhone, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import type { AppLanguage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shop_id, phone_number, label } = body;
    if (!shop_id || !phone_number) throw new VoiceApiError(400, "shop_id_and_phone_required");
    const languageDetected = (request.headers.get("x-language-detected") as AppLanguage) || null;
    const result = await addShopPhone(String(shop_id), String(phone_number), label ?? "alt");
    return Response.json({ ...result, language_detected: languageDetected });
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
