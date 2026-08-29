import { createShop } from "@/lib/voice/backend";
import { voiceErrorResponse } from "@/lib/voice/backend";
import type { AppLanguage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      phone_number,
      shop_name,
      owner_name,
      area,
      preferred_language,
      beat_route_id,
      preferred_call_start,
      preferred_call_end,
    } = body;

    const languageDetected = (request.headers.get("x-language-detected") as AppLanguage) || null;

    if (!phone_number || !shop_name || !owner_name || !area || !preferred_language) {
      return Response.json({ error: "missing_required_fields" }, { status: 400 });
    }

    const result = await createShop(
      {
        phone_number,
        shop_name,
        owner_name,
        area,
        preferred_language,
        beat_route_id: beat_route_id ?? null,
        preferred_call_start: preferred_call_start ?? null,
        preferred_call_end: preferred_call_end ?? null,
      },
      languageDetected
    );
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
