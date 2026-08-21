export async function parseBody(request: Request): Promise<Record<string, string>> {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });

  try {
    const text = await request.text();
    if (text) {
      try {
        const json = JSON.parse(text);
        if (typeof json === "object" && json !== null) {
          for (const [k, v] of Object.entries(json)) {
            if (v != null) params[k] = String(v);
          }
        }
      } catch {
        const form = new URLSearchParams(text);
        form.forEach((v, k) => { params[k] = v; });
      }
    }
  } catch { /* ignore */ }

  return params;
}
