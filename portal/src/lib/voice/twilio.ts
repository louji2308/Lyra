import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER!;

export const twilioClient = twilio(accountSid, authToken);

export interface OutboundCallOptions {
  to: string;
  webhookUrl: string;
}

export async function makeOutboundCall(options: OutboundCallOptions) {
  const call = await twilioClient.calls.create({
    from: twilioPhoneNumber,
    to: options.to,
    url: options.webhookUrl,
    method: "POST",
    timeout: 60,
    record: false,
  });
  return call;
}

export function generateTwiML(streamUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;
}

export function getStreamUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const wsPort = process.env.TWILIO_WS_PORT ?? "3001";
  const wsHost = baseUrl.replace(/^https?:\/\//, "").split(":")[0];
  return `ws://${wsHost}:${wsPort}`;
}

export const TWILIO_WS_PORT: string = process.env.TWILIO_WS_PORT ?? "3001";