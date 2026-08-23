import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to portal/.env.local"
  );
}

if (!serviceKey) {
  // Fall back to the anon key. Safe only because RLS policies are currently
  // allow-all; add SUPABASE_SERVICE_ROLE_KEY to .env.local before locking
  // down RLS or deploying to production.
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY not set - falling back to anon key for admin operations"
  );
}

export const supabaseAdmin = createClient(url, serviceKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});