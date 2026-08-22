import { searchCatalog } from "@/lib/voice/backend";
import { voiceErrorResponse } from "@/lib/voice/backend";
import type { AppLanguage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query");
    const languageDetected = url.searchParams.get("language_detected") as AppLanguage | null;

    if (!query) {
      return Response.json({ error: "query_required" }, { status: 400 });
    }

    const result = await searchCatalog(query, languageDetected);
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}