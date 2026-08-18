interface ExotelCallOptions {
  to: string;
  webhookUrl: string;
}

export async function makeExotelCall(options: ExotelCallOptions) {
  const sid = process.env.EXOTEL_SID!;
  const apiKey = process.env.EXOTEL_API_KEY!;
  const apiToken = process.env.EXOTEL_API_TOKEN!;
  const from = process.env.EXOTEL_NUMBER!;

  const auth = btoa(`${apiKey}:${apiToken}`);
  const body = new URLSearchParams({
    From: options.to,
    To: from,
    CallerId: from,
    Url: options.webhookUrl,
    CallType: "trans",
  });

  const res = await fetch(`https://api.exotel.com/v1/Accounts/${sid}/Calls/connect.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  return res.json();
}