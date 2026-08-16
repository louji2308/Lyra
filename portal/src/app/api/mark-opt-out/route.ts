import { markOptOut, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";

export async function POST(request: Request) {
  try {
    let body: { shop_id?: string };
    try {
      body = await request.json();
    } catch {
      throw new VoiceApiError(400, "invalid_json");
    }
    if (!body.shop_id) throw new VoiceApiError(400, "shop_id_required");
    return Response.json(await markOptOut(body.shop_id));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
