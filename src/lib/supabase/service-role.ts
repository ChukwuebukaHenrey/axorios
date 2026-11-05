import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

let client: SupabaseClient<Database> | undefined;

/** Bypasses row-level security. Use only inside module functions that scope by storeId. */
export function serviceRoleClient(): SupabaseClient<Database> {
  if (!client) {
    const e = env();
    client = createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
