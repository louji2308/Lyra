import { checkStock, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    const product_id = params.product_id;
    if (!product_id) throw new VoiceApiError(400, "product_id_required");
    const quantity = params.quantity != null ? Number(params.quantity) : undefined;
    return Response.json(await checkStock(product_id, quantity));
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
