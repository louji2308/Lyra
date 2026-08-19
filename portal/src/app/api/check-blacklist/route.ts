import { checkBlacklist, voiceErrorResponse } from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const params = await parseBody(request);
  if (!params.shop_id || !params.product_id) {
    return Response.json({ error: "shop_id_and_product_id_required" }, { status: 400 });
  }
  try {
    const result = await checkBlacklist(params.shop_id, params.product_id);
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
