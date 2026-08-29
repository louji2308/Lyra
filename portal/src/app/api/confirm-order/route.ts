import { confirmOrder, VoiceApiError } from "@/lib/voice/backend";
import { voiceErrorResponse } from "@/lib/voice/backend";

export const dynamic = "force-dynamic";

// confirm_order (human-triggered via portal or agent call): final confirmation
// that decrements inventory, records stock movements, and sends WhatsApp.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { order_id, performed_by, send_whatsapp } = body;
    if (!order_id) throw new VoiceApiError(400, "order_id_required");
    const result = await confirmOrder(String(order_id), {
      performed_by: performed_by ?? "portal",
      send_whatsapp: send_whatsapp !== false,
    });
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
