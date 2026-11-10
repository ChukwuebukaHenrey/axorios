import { storeChoice } from "@/lib/store-cookie";
import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";

/** The signed-in seller, read from the verified access token (no Auth server round trip). */
export type SessionUser = { id: string; email: string | null; user_metadata: Record<string, unknown> };

/**
 * The signed-in seller and their store, once per request. The store always comes from the session, never from input.
 * getClaims() checks the JWT signature locally against the project's cached JWKS (ES256), so a tampered or expired
 * cookie fails here exactly as it did with getUser(); RLS still sees the same token on every query.
 */
export const requireSeller = cache(async () => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== "authenticated") redirect("/sign-in");
  const user: SessionUser = { id: claims.sub, email: claims.email ?? null, user_metadata: claims.user_metadata ?? {} };
  const store = await getOrCreateStore(supabase, user.id, await storeChoice());
  return { supabase, user, store };
});
