import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SNAPSERVE_API_KEY = process.env.SNAPSERVE_API_KEY ?? "";
const SNAPSERVE_BASE = "https://app.snapserve.ai/api";
const AGENT_ID = 797;

export async function POST(request: Request) {
  try {
    const { toNumber, variables } = await request.json();

    if (!toNumber) {
      return NextResponse.json({ error: "toNumber required" }, { status: 400 });
    }

    const res = await fetch(`${SNAPSERVE_BASE}/calls/outbound`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SNAPSERVE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agentId: AGENT_ID,
        toNumber,
        variables: variables ?? { caller_number: toNumber },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
