import { updateBlacklistEntry, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    if (!params.blacklist_id) throw new VoiceApiError(400, "blacklist_id_required");

    const patch: { reason?: string | null; product_id?: string } = {};
    if (params.reason != null) patch.reason = params.reason;
    if (params.product_id != null) patch.product_id = params.product_id;

    return Response.json(await updateBlacklistEntry(Number(params.blacklist_id), patch));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}