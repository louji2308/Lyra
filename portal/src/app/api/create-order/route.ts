import {
  createOrder,
  type CreateOrderInputItem,
  VoiceApiError,
  voiceErrorResponse,
} from "@/lib/voice/backend";
import type { AppLanguage, OrderStatus, PaymentStatus } from "@/lib/types";

export async function POST(request: Request) {
  try {
    let body: {
      shop_id?: string;
      items?: CreateOrderInputItem[];
      payment_status?: PaymentStatus;
      order_status?: OrderStatus;
      transcript_summary?: string;
      language_detected?: AppLanguage | null;
    };
    try {
      body = await request.json();
    } catch {
      throw new VoiceApiError(400, "invalid_json");
    }
    const result = await createOrder(body.shop_id ?? "", body.items ?? [], {
      payment_status: body.payment_status,
      order_status: body.order_status,
      transcript_summary: body.transcript_summary,
      language_detected: body.language_detected,
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
