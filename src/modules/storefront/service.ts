import "server-only";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { BrandKitSchema } from "@/modules/brand";
import { listProducts } from "@/modules/catalog";
import { buildSiteConfig } from "./presets";
import { ContactChannelsSchema, SiteConfigSchema, type SiteConfig } from "./schema";
import { safeLocale } from "./theme";
import { getDraftConfig, storeIdFromDraftToken } from "./versions";

type StoreRow = {
  id: string;
  slug: string;
  brand_kit: unknown;
  store_language: string;
  contact_channels: unknown;
};

const STORE_COLUMNS = "id, slug, brand_kit, store_language, contact_channels";

async function assemble(store: StoreRow, config: SiteConfig | null) {
  const kit = BrandKitSchema.safeParse(store.brand_kit);
  if (!kit.success) return null;
  const contact = ContactChannelsSchema.safeParse(store.contact_channels);

  return {
    storeId: store.id,
    slug: store.slug,
    kit: kit.data,
    locale: safeLocale(store.store_language),
    contact: contact.success ? contact.data : {},
    config: config ?? buildSiteConfig(kit.data),
    products: await listProducts(store.id),
  };
}

/** A live store by its public slug. Reads go through row-level security, which only exposes live stores. */
export const getLiveStorefront = cache(async (slug: string) => {
  const supabase = await createServerSupabase();
  const { data: store, error } = await supabase
    .from("stores")
    .select(STORE_COLUMNS)
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  if (!store) return null;

  const { data: version, error: versionError } = await supabase
    .from("site_versions")
    .select("config")
    .eq("store_id", store.id)
    .eq("status", "published")
    .maybeSingle();
  if (versionError) throw new Error(`Site read failed: ${versionError.code}`);

  const config = SiteConfigSchema.safeParse(version?.config);
  return assemble(store, config.success ? config.data : null);
});

/** A store's draft, for whoever holds its signed link. The store comes from the token, not the URL. */
export const getDraftStorefront = cache(async (token: string) => {
  const storeId = storeIdFromDraftToken(token);
  if (!storeId) return null;

  const { data: store, error } = await serviceRoleClient()
    .from("stores")
    .select(STORE_COLUMNS)
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  if (!store) return null;

  return assemble(store, await getDraftConfig(store.id));
});

export type Storefront = NonNullable<Awaited<ReturnType<typeof getLiveStorefront>>>;
