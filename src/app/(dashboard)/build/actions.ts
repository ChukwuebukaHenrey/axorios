"use server";

import { storeChoice } from "@/lib/store-cookie";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";
import { shopConnection, type SyncResult } from "@/modules/platforms";
import {
  listVersions,
  MARKET_PRESETS,
  restoreVersion,
  revertDraft,
  switchDraftPreset,
  type MarketPresetId,
  type SiteVersion,
} from "@/modules/storefront";

/** These work without the model, so they still work if the AI provider is down. The store comes from the session. */
async function sessionStoreId(): Promise<string> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return (await getOrCreateStore(supabase, user.id, await storeChoice())).id;
}

export async function shopifySyncResult(): Promise<SyncResult | null> {
  return (await shopConnection(await sessionStoreId()))?.lastResult ?? null;
}

export async function undoDraftEdit(): Promise<boolean> {
  return revertDraft(await sessionStoreId());
}

const PresetId = z.enum(Object.keys(MARKET_PRESETS) as [MarketPresetId, ...MarketPresetId[]]);

export async function chooseTemplate(presetId: string): Promise<void> {
  await switchDraftPreset(await sessionStoreId(), PresetId.parse(presetId), "seller");
}

export async function siteVersions(): Promise<SiteVersion[]> {
  return listVersions(await sessionStoreId());
}

export async function restoreSiteVersion(versionId: string): Promise<boolean> {
  return restoreVersion(await sessionStoreId(), z.uuid().parse(versionId));
}
