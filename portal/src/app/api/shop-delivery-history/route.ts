import { getShopDeliveryHistory, VoiceApiError } from "@/lib/voice/backend";
import { voiceErrorResponse } from "@/lib/voice/backend";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shop_id } = body;
    if (!shop_id) throw new VoiceApiError(400, "shop_id_required");
    const result = await getShopDeliveryHistory(String(shop_id));
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
