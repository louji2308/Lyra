import { getShops } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const shops = await getShops();
  return Response.json(shops);
}