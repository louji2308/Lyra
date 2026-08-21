import { saveMemory, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";
import type { MemoryType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    const shop_id = params.shop_id;
    const memory_text = params.memory_text;
    const memory_type = params.memory_type as MemoryType | undefined;
    if (!shop_id) throw new VoiceApiError(400, "shop_id_required");
    if (!memory_text) throw new VoiceApiError(400, "memory_text_required");
    if (!memory_type) throw new VoiceApiError(400, "memory_type_required");

    const confirmed = params.confirmed_by_user === "true" || params.confirmed_by_user === true as unknown;
    const confidence = params.confidence_score ? Number(params.confidence_score) : 0.5;

    return Response.json(
      await saveMemory(shop_id, memory_text, memory_type, confirmed, confidence),
      { status: 201 }
    );
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
