import { saveComplaint, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";
import type { ComplaintType, Severity } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    const shop_id = params.shop_id;
    const complaint_type = params.complaint_type as ComplaintType | undefined;
    if (!shop_id) throw new VoiceApiError(400, "shop_id_required");
    if (!complaint_type) throw new VoiceApiError(400, "complaint_type_required");

    const severity = params.severity as Severity | undefined;
    const callback = params.callback_requested === "true";

    return Response.json(
      await saveComplaint(shop_id, complaint_type, params.description ?? null, {
        severity,
        callback_requested: callback,
      }),
      { status: 201 }
    );
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
