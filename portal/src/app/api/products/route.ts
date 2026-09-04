import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase
    .from("products")
    .select("product_id, product_name, brand, category, price, unit_type")
    .eq("is_active", true)
    .order("product_name");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? []);
}
