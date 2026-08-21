export async function parseBody(request: Request): Promise<Record<string, string>> {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });

  const contentType = request.headers.get("content-type") || "";
  let bodyText: string;

  try {
    bodyText = await request.text();
  } catch {
    return params;
  }

  if (!bodyText) return params;

  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(bodyText);
      if (typeof json === "object" && json !== null) {
        for (const [k, v] of Object.entries(json)) {
          if (v != null) params[k] = String(v);
        }
      }
      return params;
    } catch {
      return params;
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    try {
      const form = new URLSearchParams(bodyText);
      form.forEach((v, k) => { params[k] = v; });
    } catch { /* ignore */ }
    return params;
  }

  try {
    const json = JSON.parse(bodyText);
    if (typeof json === "object" && json !== null) {
      for (const [k, v] of Object.entries(json)) {
        if (v != null) params[k] = String(v);
      }
    }
  } catch {
    try {
      const form = new URLSearchParams(bodyText);
      form.forEach((v, k) => { params[k] = v; });
    } catch { /* ignore */ }
  }

  return params;
}
