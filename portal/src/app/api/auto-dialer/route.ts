import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/auto-dialer — check for shops to call right now
// POST /api/auto-dialer — manually trigger for a specific shop or all due shops
export async function GET() {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

    // Find routes scheduled for today
    const { data: routes } = await supabaseAdmin
      .from("routes")
      .select("route_id")
      .eq("beat_day", dayOfWeek)
      .eq("is_active", true);

    if (!routes?.length) {
      return NextResponse.json({ due_shops: [], message: "No routes scheduled for today" });
    }

    const routeIds = routes.map((r) => r.route_id);

    // Find shops on today's routes that have a preferred_call_time or temp_call_time
    // matching the current hour (within 5 minute window)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const windowStart = `${String(currentHour).padStart(2, "0")}:${String(Math.max(0, currentMinute - 2)).padStart(2, "0")}`;
    const windowEnd = `${String(currentHour).padStart(2, "0")}:${String(Math.min(59, currentMinute + 2)).padStart(2, "0")}`;

    const { data: shops } = await supabaseAdmin
      .from("shops")
      .select("shop_id, shop_name, phone_number, preferred_call_start, temp_call_time, beat_route_id")
      .in("beat_route_id", routeIds)
      .eq("opt_out", false)
      .eq("voice_consent", true);

    // Filter shops whose call time matches now
    const dueShops = (shops ?? []).filter((s) => {
      const callTime = s.temp_call_time || s.preferred_call_start;
      if (!callTime) return false;
      // callTime could be "HH:MM:SS" or "HH:MM"
      const timeStr = String(callTime).slice(0, 5);
      return timeStr >= windowStart && timeStr <= windowEnd;
    });

    // Check which have already been called today
    const today = now.toISOString().slice(0, 10);
    const dueShopIds = dueShops.map((s) => s.shop_id);
    const { data: calledToday } = await supabaseAdmin
      .from("beat_calls")
      .select("shop_id")
      .eq("call_date", today)
      .in("shop_id", dueShopIds);

    const alreadyCalled = new Set((calledToday ?? []).map((c) => c.shop_id));
    const pendingShops = dueShops.filter((s) => !alreadyCalled.has(s.shop_id));

    return NextResponse.json({
      time: currentTime,
      day_of_week: dayOfWeek,
      due_shops: pendingShops.map((s) => ({
        shop_id: s.shop_id,
        shop_name: s.shop_name,
        phone_number: s.phone_number,
        call_time: String(s.temp_call_time || s.preferred_call_start).slice(0, 5),
        is_temp: !!s.temp_call_time && !s.preferred_call_start,
      })),
      total_eligible: dueShops.length,
      already_called: dueShops.length - pendingShops.length,
    });
  } catch (err) {
    console.error("Auto-dialer GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

// POST /api/auto-dialer — trigger calls
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { shop_id, action = "call_all" } = body;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const dayOfWeek = now.getDay();

    if (action === "call_all") {
      // Find today's routes
      const { data: routes } = await supabaseAdmin
        .from("routes")
        .select("route_id")
        .eq("beat_day", dayOfWeek)
        .eq("is_active", true);

      if (!routes?.length) {
        return NextResponse.json({ called: 0, message: "No routes today" });
      }

      const routeIds = routes.map((r) => r.route_id);

      // Find shops with call time within window
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const windowStart = `${String(currentHour).padStart(2, "0")}:${String(Math.max(0, currentMinute - 5)).padStart(2, "0")}`;
      const windowEnd = `${String(currentHour).padStart(2, "0")}:${String(Math.min(59, currentMinute + 5)).padStart(2, "0")}`;

      const { data: shops } = await supabaseAdmin
        .from("shops")
        .select("shop_id, shop_name, phone_number, preferred_call_start, temp_call_time, beat_route_id")
        .in("beat_route_id", routeIds)
        .eq("opt_out", false)
        .eq("voice_consent", true);

      const dueShops = (shops ?? []).filter((s) => {
        const callTime = s.temp_call_time || s.preferred_call_start;
        if (!callTime) return false;
        const timeStr = String(callTime).slice(0, 5);
        return timeStr >= windowStart && timeStr <= windowEnd;
      });

      // Filter out already called
      const { data: calledToday } = await supabaseAdmin
        .from("beat_calls")
        .select("shop_id")
        .eq("call_date", today);
      const alreadyCalled = new Set((calledToday ?? []).map((c) => c.shop_id));
      const toCall = dueShops.filter((s) => !alreadyCalled.has(s.shop_id));

      let calledCount = 0;
      const baseUrl = process.env.TUNNEL_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      for (const shop of toCall) {
        try {
          // Create beat_call record
          const { data: beatCall } = await supabaseAdmin
            .from("beat_calls")
            .insert({
              call_date: today,
              route_id: shop.beat_route_id ?? "R003",
              shop_id: shop.shop_id,
              status: "calling",
            })
            .select("id")
            .single();

          // Trigger outbound call
          await fetch(`${baseUrl}/api/call`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shop_id: shop.shop_id, provider: "twilio" }),
          });

          // Clear temp_call_time after scheduling
          if (shop.temp_call_time) {
            await supabaseAdmin
              .from("shops")
              .update({ temp_call_time: null })
              .eq("shop_id", shop.shop_id);
          }

          calledCount++;
          console.log(`Auto-dial: ${shop.shop_name} (${shop.shop_id}) — beat_call ${beatCall?.id}`);
        } catch (err) {
          console.error(`Failed to call ${shop.shop_id}:`, err);
        }
      }

      return NextResponse.json({
        success: true,
        called: calledCount,
        skipped: toCall.length - calledCount,
        total_due: dueShops.length,
      });
    }

    // Call a specific shop
    if (shop_id) {
      const baseUrl = process.env.TUNNEL_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const { data: beatCall } = await supabaseAdmin
        .from("beat_calls")
        .insert({
          call_date: today,
          route_id: "R003",
          shop_id,
          status: "calling",
        })
        .select("id")
        .single();

      await fetch(`${baseUrl}/api/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id, provider: "twilio" }),
      });

      return NextResponse.json({ success: true, beat_call_id: beatCall?.id });
    }

    return NextResponse.json({ error: "No action specified" }, { status: 400 });
  } catch (err) {
    console.error("Auto-dialer POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
