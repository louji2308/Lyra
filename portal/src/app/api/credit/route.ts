import { NextRequest, NextResponse } from "next/server";
import { adjustShopCredit, updateShopCreditLimit } from "@/lib/actions";

// POST /api/credit/adjust - adjust shop credit
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, shop_id, amount, reason, type, credit_limit } = body;

    if (!shop_id) {
      return NextResponse.json({ error: "shop_id required" }, { status: 400 });
    }

    if (action === "update_limit") {
      if (credit_limit === undefined) {
        return NextResponse.json({ error: "credit_limit required" }, { status: 400 });
      }
      const result = await updateShopCreditLimit({ shop_id, credit_limit });
      return NextResponse.json(result);
    }

    // Default: adjust credit
    if (!amount || !reason || !type) {
      return NextResponse.json({ error: "amount, reason, and type required" }, { status: 400 });
    }

    if (type !== "credit" && type !== "debit") {
      return NextResponse.json({ error: "type must be 'credit' or 'debit'" }, { status: 400 });
    }

    const result = await adjustShopCredit({ shop_id, amount, reason, type });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Credit adjust error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
