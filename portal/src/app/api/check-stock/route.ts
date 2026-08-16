import { checkStock, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";

export async function POST(request: Request) {
  try {
    let body: { product_id?: string; quantity?: number };
    try {
      body = await request.json();
    } catch {
      throw new VoiceApiError(400, "invalid_json");
    }
    if (!body.product_id) throw new VoiceApiError(400, "product_id_required");
    return Response.json(
      await checkStock(body.product_id, body.quantity != null ? Number(body.quantity) : undefined)
    );
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
