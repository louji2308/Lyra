import { listProducts } from "@/lib/voice/backend";
import { voiceErrorResponse } from "@/lib/voice/backend";
import type { AppLanguage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category") || undefined;
    const brand = url.searchParams.get("brand") || undefined;
    const in_stock_only = url.searchParams.get("in_stock_only") === "true";
    const languageDetected = url.searchParams.get("language_detected") as AppLanguage | null;

    const result = await listProducts({ category, brand, in_stock_only, languageDetected });
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}