import { sendWhatsAppSummary, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const params = await parseBody(request);
  if (!params.shop_id || !params.order_id) {
    return Response.json({ error: "shop_id_and_order_id_required" }, { status: 400 });
  }
  try {
    const result = await sendWhatsAppSummary(params.shop_id, params.order_id);
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
