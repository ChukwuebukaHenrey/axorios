"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";
import { revertDraft } from "@/modules/storefront";

/** Works without the model, so Undo still works if the AI provider is down. The store comes from the session. */
export async function undoDraftEdit(): Promise<boolean> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const store = await getOrCreateStore(supabase, user.id);
  return revertDraft(store.id);
}
