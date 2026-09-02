import { NextRequest, NextResponse } from "next/server";
import {
  getBeatSchedule,
  generateBeatCalls,
  getTodayBeatCalls,
  updateBeatCallStatus,
} from "@/lib/voice/backend";

// GET /api/beat-schedule - full weekly schedule
export async function GET() {
  try {
    const schedule = await getBeatSchedule();
    const todayCalls = await getTodayBeatCalls();
    return NextResponse.json({ schedule, today_calls: todayCalls });
  } catch (err) {
    console.error("Beat schedule error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

// POST /api/beat-schedule - generate today's beat calls
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // If action is "update_status", update a specific beat call
    if (body.action === "update_status") {
      const { beat_call_id, status, order_id } = body;
      if (!beat_call_id || !status) {
        return NextResponse.json({ error: "beat_call_id and status required" }, { status: 400 });
      }
      await updateBeatCallStatus(beat_call_id, status, order_id);
      return NextResponse.json({ success: true });
    }

    // Default: generate today's beat calls
    const result = await generateBeatCalls();
    const todayCalls = await getTodayBeatCalls();
    return NextResponse.json({ success: true, ...result, today_calls: todayCalls });
  } catch (err) {
    console.error("Beat schedule POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
