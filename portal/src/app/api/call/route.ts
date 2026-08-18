import { NextRequest, NextResponse } from "next/server";
import { getShopContext } from "@/lib/voice/backend";
import { makeOutboundCall } from "@/lib/voice/twilio";
import { makeExotelCall } from "@/lib/voice/exotel";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shop_id, provider = "twilio" } = body;

    if (!shop_id) {
      return NextResponse.json({ error: "shop_id required" }, { status: 400 });
    }

    const shop = await getShopContext(shop_id);
    if (!shop.phone_number) {
      return NextResponse.json({ error: "Shop has no phone number" }, { status: 400 });
    }

    if (provider === "exotel") {
      const baseUrl = process.env.TUNNEL_URL ?? `http://localhost:${process.env.TWILIO_WS_PORT ?? "3001"}`;
      const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/exotel/voice`;

      const call = await makeExotelCall({
        to: shop.phone_number,
        webhookUrl,
      });

      return NextResponse.json({
        success: true,
        call: call,
        to: shop.phone_number,
        shop_name: shop.shop_name,
      });
    }

    const baseUrl = process.env.TUNNEL_URL ?? `http://localhost:${process.env.TWILIO_WS_PORT ?? "3001"}`;
    const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/twilio/voice`;

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