import { NextResponse } from "next/server";
import { generateTwiML, getStreamUrl } from "@/lib/voice/twilio";

export async function POST() {
  try {
    const streamUrl = getStreamUrl();

    const twiml = generateTwiML(streamUrl);

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("TwiML generation error:", err);
    return new NextResponse(
      '<?xml version="1.0"?><Response><Say>Error connecting call</Say></Response>',
      { status: 500, headers: { "Content-Type": "text/xml" } }
    );
  }
}