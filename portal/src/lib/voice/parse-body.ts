export async function parseBody(request: Request): Promise<Record<string, string>> {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const json = await request.json();
      for (const [k, v] of Object.entries(json)) {
        if (v != null) params[k] = String(v);
      }
    } catch { /* ignore */ }
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    try {
      const text = await request.text();
      const form = new URLSearchParams(text);
      form.forEach((v, k) => { params[k] = v; });
    } catch { /* ignore */ }
  } else if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      formData.forEach((v, k) => { params[k] = String(v); });
    } catch { /* ignore */ }
  }

  return params;
}
