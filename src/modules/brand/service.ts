import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { applyBrandPatch, BrandKitSchema, slugify, type BrandDraft, type BrandKit, type BrandPatch } from "./schema";

const PLACEHOLDER_SLUG_PREFIX = "store-";

/** Every store the signed-in owner has, for the store switcher. Session client, so RLS limits it to them. */
export async function listOwnerStores(supabase: SupabaseClient<Database>, ownerId: string) {
  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, status, currency, brand_kit, is_demo")
    .eq("owner_id", ownerId)
    .order("created_at");
  if (error) throw new Error(`Store list failed: ${error.code}`);
  return data.map((s) => {
    const kit = BrandKitSchema.safeParse(s.brand_kit);
    return { id: s.id, slug: s.slug, status: s.status, currency: s.currency, name: kit.success ? kit.data.name : null };
  });
}

/** A new, empty draft store for the owner ("New business"). */
export async function createOwnerStore(supabase: SupabaseClient<Database>, ownerId: string) {
  const { data, error } = await supabase
    .from("stores")
    .insert({ owner_id: ownerId, slug: `${PLACEHOLDER_SLUG_PREFIX}${randomBytes(4).toString("hex")}` })
    .select("id, slug, status")
    .single();
  if (error) throw new Error(`Store create failed: ${error.code}`);
  return data;
}

/**
 * Uses the caller's session client, so row-level security limits it to the signed-in owner.
 * `preferredId` is the store switcher's choice; it only selects among the owner's own stores.
 */
export async function getOrCreateStore(supabase: SupabaseClient<Database>, ownerId: string, preferredId?: string | null) {
  if (preferredId && /^[0-9a-f-]{36}$/i.test(preferredId)) {
    const { data: chosen } = await supabase
      .from("stores")
      .select("id, slug, status")
      .eq("owner_id", ownerId)
      .eq("id", preferredId)
      .maybeSingle();
    if (chosen) return chosen;
  }
  const { data: existing, error } = await supabase
    .from("stores")
    .select("id, slug, status")
    .eq("owner_id", ownerId)
    // A seller works on their live store, if they have one: 'live' sorts before 'draft' when descending.
    .order("status", { ascending: false })
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Store lookup failed: ${error.code}`);
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("stores")
    .insert({ owner_id: ownerId, slug: `${PLACEHOLDER_SLUG_PREFIX}${randomBytes(4).toString("hex")}` })
    .select("id, slug, status")
    .single();
  if (insertError) throw new Error(`Store create failed: ${insertError.code}`);
  return created;
}

export async function getBrandKit(storeId: string): Promise<BrandKit | null> {
  const { data, error } = await serviceRoleClient().from("stores").select("brand_kit").eq("id", storeId).single();
  if (error) throw new Error(`Brand kit read failed: ${error.code}`);
  const parsed = BrandKitSchema.safeParse(data.brand_kit);
  return parsed.success ? parsed.data : null;
}

async function writeSlug(storeId: string, name: string): Promise<void> {
  const db = serviceRoleClient();
  const base = slugify(name);
  for (const candidate of [base, `${base}-${randomBytes(2).toString("hex")}`]) {
    const { error } = await db.from("stores").update({ slug: candidate }).eq("id", storeId);
    if (!error) return;
    if (error.code !== "23505") throw new Error(`Slug update failed: ${error.code}`);
  }
}

async function claimSlug(storeId: string, name: string): Promise<void> {
  const { data } = await serviceRoleClient().from("stores").select("slug").eq("id", storeId).single();
  if (data?.slug.startsWith(PLACEHOLDER_SLUG_PREFIX)) await writeSlug(storeId, name);
}

/** Before a store's first publish, its link follows the current name. Once live, the link never changes. */
export async function refreshDraftSlug(storeId: string): Promise<void> {
  const { data, error } = await serviceRoleClient()
    .from("stores")
    .select("slug, status, brand_kit")
    .eq("id", storeId)
    .single();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  if (data.status !== "draft") return;

  const kit = BrandKitSchema.safeParse(data.brand_kit);
  if (!kit.success) return;
  const base = slugify(kit.data.name);
  const current = data.slug === base || (data.slug.startsWith(`${base}-`) && /-[0-9a-f]{4}$/.test(data.slug));
  if (!current) await writeSlug(storeId, kit.data.name);
}

export async function createBrandKit(storeId: string, draft: BrandDraft, storeLanguage: string): Promise<BrandKit> {
  const existing = await getBrandKit(storeId);
  const kit = BrandKitSchema.parse({
    ...draft,
    logoUrl: existing?.logoUrl ?? null,
    referenceImageUrls: existing?.referenceImageUrls ?? [],
  });
  const { error } = await serviceRoleClient()
    .from("stores")
    .update({ brand_kit: kit as unknown as Json, store_language: storeLanguage })
    .eq("id", storeId);
  if (error) throw new Error(`Brand kit save failed: ${error.code}`);
  await claimSlug(storeId, kit.name);
  return kit;
}

export async function updateBrandKit(storeId: string, patch: BrandPatch): Promise<BrandKit> {
  const current = await getBrandKit(storeId);
  if (!current) throw new Error("No brand kit yet");
  const kit = applyBrandPatch(current, patch);
  const { error } = await serviceRoleClient()
    .from("stores")
    .update({ brand_kit: kit as unknown as Json })
    .eq("id", storeId);
  if (error) throw new Error(`Brand kit save failed: ${error.code}`);
  return kit;
}
