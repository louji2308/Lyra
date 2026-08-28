import { getActiveSchemes } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const schemes = await getActiveSchemes();
  return Response.json(schemes);
}