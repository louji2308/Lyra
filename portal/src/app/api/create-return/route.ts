import { createReturn, voiceErrorResponse } from "@/lib/voice/backend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    shop_id?: string;
    product_id?: string;
    quantity?: number;
    reason?: string;
    order_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  if (!body.shop_id || !body.product_id || !body.quantity) {
    return Response.json({ error: "shop_id_product_id_and_quantity_required" }, { status: 400 });
  }
  try {
    const result = await createReturn(
      body.shop_id,
      body.product_id,
      body.quantity,
      body.reason ?? null,
      body.order_id
    );
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
