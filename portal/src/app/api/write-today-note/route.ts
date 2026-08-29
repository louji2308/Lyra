import { writeTodayNote, VoiceApiError } from "@/lib/voice/backend";
import { voiceErrorResponse } from "@/lib/voice/backend";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shop_id, note_text, note_type, source, agent_role } = body;
    if (!shop_id || !note_text) throw new VoiceApiError(400, "shop_id_and_note_text_required");
    const result = await writeTodayNote(String(shop_id), String(note_text), {
      note_type: note_type ?? "general",
      source: source === "human" ? "human" : "AI",
      agent_role: agent_role ?? null,
    });
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
