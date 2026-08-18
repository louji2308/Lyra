import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const wsUrl = process.env.TUNNEL_URL?.replace(/^https?:\/\//, "wss://") ?? "wss://localhost:3001";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" audioTrack="inbound" contentType="audio/x-mulaw;rate=8000">${wsUrl}</Stream>
</Response>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}