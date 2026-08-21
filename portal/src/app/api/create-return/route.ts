import { createReturn, VoiceApiError, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);
    const shop_id = params.shop_id;
    const product_id = params.product_id;
    const quantity = params.quantity ? Number(params.quantity) : undefined;
    if (!shop_id) throw new VoiceApiError(400, "shop_id_required");
    if (!product_id) throw new VoiceApiError(400, "product_id_required");
    if (!quantity) throw new VoiceApiError(400, "quantity_required");

    const result = await createReturn(
      shop_id,
      product_id,
      quantity,
      params.reason ?? null,
      params.order_id
    );
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
