import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client for narrowly scoped administrative operations.
 * Never import this module from a Client Component.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Konfigurasi server Supabase belum lengkap. SUPABASE_SERVICE_ROLE_KEY atau SUPABASE_SECRET_KEY diperlukan.",
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
