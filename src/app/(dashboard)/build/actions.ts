"use server";

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";
import { MARKET_PRESETS, revertDraft, switchDraftPreset, type MarketPresetId } from "@/modules/storefront";

/** These work without the model, so they still work if the AI provider is down. The store comes from the session. */
async function sessionStoreId(): Promise<string> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return (await getOrCreateStore(supabase, user.id)).id;
}

export async function undoDraftEdit(): Promise<boolean> {
  return revertDraft(await sessionStoreId());
}

const PresetId = z.enum(Object.keys(MARKET_PRESETS) as [MarketPresetId, ...MarketPresetId[]]);

export async function chooseTemplate(presetId: string): Promise<void> {
  await switchDraftPreset(await sessionStoreId(), PresetId.parse(presetId), "seller");
}
