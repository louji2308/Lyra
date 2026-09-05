import { deleteShopMemory, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    if (!params.memory_id) throw new VoiceApiError(400, "memory_id_required");
    return Response.json(await deleteShopMemory(Number(params.memory_id)));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}