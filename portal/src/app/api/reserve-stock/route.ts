import { reserveStock } from "@/lib/voice/backend";
import { voiceErrorResponse } from "@/lib/voice/backend";
import type { AppLanguage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { product_id, quantity, remove } = body;
    if (!product_id || quantity == null) {
      return Response.json({ error: "product_id_and_quantity_required" }, { status: 400 });
    }
    const languageDetected = (request.headers.get("x-language-detected") as AppLanguage) || null;
    const result = await reserveStock(String(product_id), Number(quantity), Boolean(remove));
    return Response.json({ ...result, language_detected: languageDetected });
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
