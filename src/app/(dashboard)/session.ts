import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";

/** The signed-in seller and their store, once per request. The store always comes from the session, never from input. */
export const requireSeller = cache(async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const store = await getOrCreateStore(supabase, user.id);
  return { supabase, user, store };
});
