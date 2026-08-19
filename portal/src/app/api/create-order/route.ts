import {
  createOrder,
  type CreateOrderInputItem,
  voiceErrorResponse,
} from "@/lib/voice/backend";
import { parseBody } from "@/lib/voice/parse-body";
import type { AppLanguage, OrderStatus, PaymentStatus } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const params = await parseBody(request);

    let items: CreateOrderInputItem[] = [];
    if (params.items) {
      try { items = JSON.parse(params.items); } catch { /* empty */ }
    }

    const result = await createOrder(params.shop_id ?? "", items, {
      payment_status: params.payment_status as PaymentStatus | undefined,
      order_status: params.order_status as OrderStatus | undefined,
      transcript_summary: params.transcript_summary,
      language_detected: params.language_detected as AppLanguage | null | undefined,
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
