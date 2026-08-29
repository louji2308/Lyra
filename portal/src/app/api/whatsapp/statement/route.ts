import { supabase } from "@/lib/supabase";
import { formatMonthlyStatement, type MonthlyStatementData } from "@/lib/voice/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shop_id, period } = body;

    if (!shop_id) {
      return Response.json({ error: "shop_id required" }, { status: 400 });
    }

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("shop_id, shop_name, whatsapp_number, whatsapp_consent, credit_limit, outstanding_balance")
      .eq("shop_id", shop_id)
      .maybeSingle();
    if (shopError) throw shopError;
    if (!shop) return Response.json({ error: "shop_not_found" }, { status: 404 });
    if (!shop.whatsapp_consent) return Response.json({ error: "whatsapp_not_consented" }, { status: 400 });
    if (!shop.whatsapp_number) return Response.json({ error: "no_whatsapp_number" }, { status: 400 });

    const { data: orders } = await supabase
      .from("orders")
      .select("order_id, order_date, total_amount")
      .eq("shop_id", shop_id)
      .order("order_date", { ascending: false })
      .limit(10);

    const { data: payments } = await supabase
      .from("shop_payment_ledger")
      .select("collected_at, amount, method")
      .eq("shop_id", shop_id)
      .order("collected_at", { ascending: false })
      .limit(10);

    const periodStr = period ?? new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const available_credit = Number(shop.credit_limit) - Number(shop.outstanding_balance);

    const data: MonthlyStatementData = {
      shop_name: shop.shop_name,
      period: periodStr,
      outstanding: Number(shop.outstanding_balance),
      credit_limit: Number(shop.credit_limit),
      available_credit,
      recent_orders: (orders ?? []).map((o) => ({
        id: o.order_id,
        date: o.order_date,
        amount: Number(o.total_amount),
      })),
      payments: (payments ?? []).map((p) => ({
        date: p.collected_at?.split("T")[0] ?? "",
        amount: Number(p.amount),
        method: p.method,
      })),
    };

    const message = formatMonthlyStatement(data);

    return Response.json({
      success: true,
      shop_id,
      message_preview: message.slice(0, 300),
      whatsapp_number: shop.whatsapp_number,
    });
  } catch (err: unknown) {
    console.error("[whatsapp/statement] error:", err);
    return Response.json({ error: "internal_error", detail: String(err) }, { status: 500 });
  }
}