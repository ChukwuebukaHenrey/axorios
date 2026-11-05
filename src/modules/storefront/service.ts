import "server-only";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { BrandKitSchema } from "@/modules/brand";
import { listProducts } from "@/modules/catalog";
import { buildSiteConfig } from "./presets";
import { ContactChannelsSchema, SiteConfigSchema } from "./schema";
import { safeLocale } from "./theme";

/** A live store by its public slug. Reads go through row-level security, which only exposes live stores. */
export const getLiveStorefront = cache(async (slug: string) => {
  const supabase = await createServerSupabase();
  const { data: store, error } = await supabase
    .from("stores")
    .select("id, slug, brand_kit, store_language, contact_channels")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  if (!store) return null;

  const kit = BrandKitSchema.safeParse(store.brand_kit);
  if (!kit.success) return null;

  const { data: version, error: versionError } = await supabase
    .from("site_versions")
    .select("config")
    .eq("store_id", store.id)
    .eq("status", "published")
    .maybeSingle();
  if (versionError) throw new Error(`Site read failed: ${versionError.code}`);

  const config = SiteConfigSchema.safeParse(version?.config);
  const contact = ContactChannelsSchema.safeParse(store.contact_channels);

  return {
    storeId: store.id,
    slug: store.slug,
    kit: kit.data,
    locale: safeLocale(store.store_language),
    contact: contact.success ? contact.data : {},
    config: config.success ? config.data : buildSiteConfig(kit.data),
    products: await listProducts(store.id),
  };
});

export type Storefront = NonNullable<Awaited<ReturnType<typeof getLiveStorefront>>>;
