import { NextRequest, NextResponse } from "next/server";
import { getShopContext } from "@/lib/voice/backend";
import { makeOutboundCall } from "@/lib/voice/twilio";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shop_id } = body;

    if (!shop_id) {
      return NextResponse.json({ error: "shop_id required" }, { status: 400 });
    }

    const shop = await getShopContext(shop_id);
    if (!shop.phone_number) {
      return NextResponse.json({ error: "Shop has no phone number" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const webhookUrl = `${baseUrl}/api/twilio/voice`;

    const call = await makeOutboundCall({
      to: shop.phone_number,
      webhookUrl,
    });

    return NextResponse.json({
      success: true,
      call_sid: call.sid,
      to: shop.phone_number,
      shop_name: shop.shop_name,
    });
  } catch (err) {
    console.error("Outbound call error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Call failed" },
      { status: 500 }
    );
  }
}