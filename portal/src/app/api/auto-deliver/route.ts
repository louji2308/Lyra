import { NextResponse } from "next/server";
import { autoCompleteDeliveries } from "@/lib/voice/backend";

// POST /api/auto-deliver - mark confirmed orders as delivered
export async function POST() {
  try {
    const result = await autoCompleteDeliveries();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Auto-deliver error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
