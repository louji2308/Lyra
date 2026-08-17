import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabase
    .from("schemes")
    .select("*")
    .eq("is_active", true);
  if (error) {
    return Response.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  return Response.json(data ?? []);
}
