import { checkCredit, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";

export async function POST(request: Request) {
  try {
    let body: { shop_id?: string; order_total?: number };
    try {
      body = await request.json();
    } catch {
      throw new VoiceApiError(400, "invalid_json");
    }
    if (!body.shop_id) throw new VoiceApiError(400, "shop_id_required");
    if (body.order_total == null) throw new VoiceApiError(400, "order_total_required");
    return Response.json(await checkCredit(body.shop_id, Number(body.order_total)));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
