import "server-only";
import type { Json } from "@/lib/database.types";
import { env } from "@/lib/env";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { getBrandKit, type BrandKit } from "@/modules/brand";
import { signDraftToken, verifyDraftToken } from "./draft-token";
import { applyBrandToConfig, applySiteEdit, type SiteEdit } from "./edit";
import { buildSiteConfig } from "./presets";
import { SiteConfigSchema, type SiteConfig } from "./schema";

async function latestConfig(storeId: string, status: "draft" | "published"): Promise<SiteConfig | null> {
  const { data, error } = await serviceRoleClient()
    .from("site_versions")
    .select("config")
    .eq("store_id", storeId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Site version read failed: ${error.code}`);
  const parsed = SiteConfigSchema.safeParse(data?.config);
  return parsed.success ? parsed.data : null;
}

/** The newest draft, else what's published, else a starting site from the brand kit. Null before a kit exists. */
export async function getDraftConfig(storeId: string): Promise<SiteConfig | null> {
  const current = (await latestConfig(storeId, "draft")) ?? (await latestConfig(storeId, "published"));
  if (current) return current;
  const kit = await getBrandKit(storeId);
  return kit && buildSiteConfig(kit);
}

async function saveDraft(storeId: string, config: SiteConfig, createdBy: "agent" | "seller"): Promise<void> {
  const { error } = await serviceRoleClient()
    .from("site_versions")
    .insert({
      store_id: storeId,
      template_id: config.preset,
      config: config as unknown as Json,
      status: "draft",
      created_by: createdBy,
    });
  if (error) throw new Error(`Draft save failed: ${error.code}`);
}

export async function editDraft(storeId: string, edit: SiteEdit): Promise<SiteConfig> {
  const current = await getDraftConfig(storeId);
  if (!current) throw new Error("Create the brand kit first");
  const next = applySiteEdit(current, edit);
  await saveDraft(storeId, next, "agent");
  return next;
}

/** Called after the brand kit changes, so the draft's colours, fonts and default hero text keep up. */
export async function syncBrandToDraft(storeId: string, kit: BrandKit, previous: BrandKit | null): Promise<void> {
  const current = await getDraftConfig(storeId);
  if (!current) return;
  await saveDraft(storeId, applyBrandToConfig(current, kit, previous), "agent");
}

/** Undoes the latest draft by archiving it, so repeating walks further back. False if nothing is left to undo. */
export async function revertDraft(storeId: string): Promise<boolean> {
  const db = serviceRoleClient();
  const { data, error } = await db
    .from("site_versions")
    .select("id")
    .eq("store_id", storeId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Draft read failed: ${error.code}`);
  if (!data) return false;

  const { error: updateError } = await db
    .from("site_versions")
    .update({ status: "archived" })
    .eq("id", data.id)
    .eq("store_id", storeId);
  if (updateError) throw new Error(`Revert failed: ${updateError.code}`);
  return true;
}

export function draftPreviewToken(storeId: string): string {
  return signDraftToken(storeId, env().DRAFT_PREVIEW_SECRET);
}

export function storeIdFromDraftToken(token: string): string | null {
  return verifyDraftToken(token, env().DRAFT_PREVIEW_SECRET);
}
