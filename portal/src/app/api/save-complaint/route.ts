import { saveComplaint, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import type { ComplaintType, Severity } from "@/lib/types";

export async function POST(request: Request) {
  try {
    let body: {
      shop_id?: string;
      complaint_type?: ComplaintType;
      description?: string;
      severity?: Severity;
      callback_requested?: boolean;
    };
    try {
      body = await request.json();
    } catch {
      throw new VoiceApiError(400, "invalid_json");
    }
    if (!body.shop_id) throw new VoiceApiError(400, "shop_id_required");
    if (!body.complaint_type) throw new VoiceApiError(400, "complaint_type_required");

    return Response.json(
      await saveComplaint(body.shop_id, body.complaint_type, body.description ?? null, {
        severity: body.severity,
        callback_requested: body.callback_requested,
      }),
      { status: 201 }
    );
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
