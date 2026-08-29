import { getProducts } from "@/lib/data";
import { findProductByBrandPrice } from "@/lib/voice/backend";
import { voiceErrorResponse } from "@/lib/voice/backend";
import type { AppLanguage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await getProducts();
  return Response.json(products);
}

// find_product_by_brand_price (SnapServe): exact brand → price filter for fast
// order entry, e.g. "i need pepsodent 10rs".
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { brand, price, name } = body;
    const languageDetected = (request.headers.get("x-language-detected") as AppLanguage) || null;
    const result = await findProductByBrandPrice(
      { brand: brand ? String(brand) : undefined, price: price != null ? Number(price) : undefined, name: name ? String(name) : undefined },
      languageDetected
    );
    return Response.json(result);
  } catch (err) {
    return voiceErrorResponse(err);
  }
}
