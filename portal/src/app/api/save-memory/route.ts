import { saveMemory, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import type { MemoryType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    let body: {
      shop_id?: string;
      memory_text?: string;
      memory_type?: MemoryType;
      confirmed_by_user?: boolean;
      confidence_score?: number;
    };
    try {
      body = await request.json();
    } catch {
      throw new VoiceApiError(400, "invalid_json");
    }
    if (!body.shop_id) throw new VoiceApiError(400, "shop_id_required");
    if (!body.memory_text) throw new VoiceApiError(400, "memory_text_required");
    if (!body.memory_type) throw new VoiceApiError(400, "memory_type_required");

    return Response.json(
      await saveMemory(
        body.shop_id,
        body.memory_text,
        body.memory_type,
        body.confirmed_by_user ?? false,
        body.confidence_score ?? 0.5
      ),
      { status: 201 }
    );
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
