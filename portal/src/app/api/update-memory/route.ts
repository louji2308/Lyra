import { updateMemory, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";
import type { MemoryType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    if (!params.memory_id) throw new VoiceApiError(400, "memory_id_required");

    const patch: {
      memory_text?: string;
      memory_type?: MemoryType;
      confidence_score?: number;
      confirmed_by_user?: boolean;
    } = {};
    if (params.memory_text != null) patch.memory_text = params.memory_text;
    if (params.memory_type != null) patch.memory_type = params.memory_type as MemoryType;
    if (params.confidence_score != null) patch.confidence_score = Number(params.confidence_score);
    if (params.confirmed_by_user != null) {
      patch.confirmed_by_user = params.confirmed_by_user === "true" || params.confirmed_by_user === true as unknown;
    }

    return Response.json(await updateMemory(Number(params.memory_id), patch));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}