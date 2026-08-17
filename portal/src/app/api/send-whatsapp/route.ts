import { sendWhatsAppSummary, voiceErrorResponse } from "@/lib/voice/backend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { shop_id?: string; order_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  if (!body.shop_id || !body.order_id) {
    return Response.json({ error: "shop_id_and_order_id_required" }, { status: 400 });
  }
  try {
    const result = await sendWhatsAppSummary(body.shop_id, body.order_id);
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
