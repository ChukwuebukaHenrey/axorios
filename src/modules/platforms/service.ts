import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { Json } from "@/lib/database.types";
import { env } from "@/lib/env";
import { inngest, PLATFORM_SYNC } from "@/lib/inngest";
import { minorToDecimal } from "@/lib/money";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { getBrandKit } from "@/modules/brand";
import { listProducts } from "@/modules/catalog";
import { quote } from "@/modules/payments";
import { getDraftConfig } from "@/modules/storefront";
import { shopify } from "./adapters/shopify";
import { isShopDomain, pagesFromStore, productHandle } from "./content";
import type { CommercePlatform, ExternalIds, ShopAccess, SyncProduct, ThemeHandoff } from "./types";

const PLATFORM = "shopify" as const;
const TOKEN_MARGIN_MS = 10 * 60 * 1000;
const PRODUCTS_PER_STEP = 25;

/** Adding a platform means one adapter file and one change here. */
function platform(): CommercePlatform {
  return shopify;
}

export class PlatformError extends Error {
  constructor(public readonly code: "invalid_domain" | "shop_not_available" | "shop_taken" | "not_connected") {
    super(code);
  }
}

export type SyncResult = {
  at: string;
  error?: string;
  products?: number;
  pages?: number;
  shopDomain?: string;
  storefrontUrl?: string;
  theme?: ThemeHandoff;
};

async function ownerOf(storeId: string): Promise<string> {
  const { data, error } = await serviceRoleClient().from("stores").select("owner_id").eq("id", storeId).single();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  return data.owner_id;
}

async function storeSlug(storeId: string): Promise<string> {
  const { data, error } = await serviceRoleClient().from("stores").select("slug").eq("id", storeId).single();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  return data.slug;
}

/**
 * Connects the shop after the seller has approved. The grant only reaches our own dev store, so only the demo store
 * may use it: anyone can sign up, and their sync mustn't overwrite the catalog judges see.
 */
export async function connectShop(storeId: string, shopDomain: string): Promise<{ shopDomain: string; shopName: string }> {
  const domain = shopDomain.trim().toLowerCase();
  if (!isShopDomain(domain)) throw new PlatformError("invalid_domain");
  const e = env();
  if (domain !== e.SHOPIFY_STORE_DOMAIN || (await storeSlug(storeId)) !== e.DEMO_STORE_SLUG) throw new PlatformError("shop_not_available");

  const grant = await platform().connect(domain);
  const shop = await platform().shopInfo({ token: grant.token, shopDomain: domain });

  const { error } = await serviceRoleClient()
    .from("platform_connections")
    .upsert(
      { store_id: storeId, owner_id: await ownerOf(storeId), platform: PLATFORM, shop_domain: domain, access_token: encryptSecret(grant.token), token_expires_at: grant.expiresAt },
      { onConflict: "store_id,platform" },
    );
  if (error?.code === "23505") throw new PlatformError("shop_taken");
  if (error) throw new Error(`Connection save failed: ${error.code}`);
  return { shopDomain: domain, shopName: shop.name };
}

export async function shopConnection(storeId: string): Promise<{ shopDomain: string; lastSyncedAt: string | null; lastResult: SyncResult | null } | null> {
  const { data, error } = await serviceRoleClient()
    .from("platform_connections")
    .select("shop_domain, last_synced_at, last_sync_result")
    .eq("store_id", storeId)
    .eq("platform", PLATFORM)
    .maybeSingle();
  if (error) throw new Error(`Connection read failed: ${error.code}`);
  if (!data?.shop_domain) return null;
  return { shopDomain: data.shop_domain, lastSyncedAt: data.last_synced_at, lastResult: data.last_sync_result as SyncResult | null };
}

/** Queues the sync after the seller has approved. */
export async function queueSync(storeId: string): Promise<void> {
  if (!(await shopConnection(storeId))) throw new PlatformError("not_connected");
  await inngest.send({ name: PLATFORM_SYNC, data: { storeId } });
}

/** A valid token, asking for a new one if this one is about to expire. The stored token is never returned to a caller outside this module. */
async function shopAccess(storeId: string): Promise<ShopAccess> {
  const db = serviceRoleClient();
  const { data, error } = await db
    .from("platform_connections")
    .select("shop_domain, access_token, token_expires_at")
    .eq("store_id", storeId)
    .eq("platform", PLATFORM)
    .maybeSingle();
  if (error) throw new Error(`Connection read failed: ${error.code}`);
  if (!data?.shop_domain || !data.access_token) throw new PlatformError("not_connected");
  const shopDomain = data.shop_domain;

  const expires = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (expires - Date.now() > TOKEN_MARGIN_MS) return { token: decryptSecret(data.access_token), shopDomain };

  const grant = await platform().connect(shopDomain);
  const { error: updateError } = await db
    .from("platform_connections")
    .update({ access_token: encryptSecret(grant.token), token_expires_at: grant.expiresAt })
    .eq("store_id", storeId)
    .eq("platform", PLATFORM);
  if (updateError) throw new Error(`Connection save failed: ${updateError.code}`);
  return { token: grant.token, shopDomain };
}

async function knownIds(storeId: string): Promise<ExternalIds> {
  const { data, error } = await serviceRoleClient()
    .from("platform_connections")
    .select("external_ids")
    .eq("store_id", storeId)
    .eq("platform", PLATFORM)
    .single();
  if (error) throw new Error(`Connection read failed: ${error.code}`);
  const ids = data.external_ids as Partial<ExternalIds>;
  return { products: ids.products ?? {}, pages: ids.pages ?? {}, collection: ids.collection };
}

async function saveIds(storeId: string, ids: ExternalIds): Promise<void> {
  const { error } = await serviceRoleClient()
    .from("platform_connections")
    .update({ external_ids: ids as unknown as Json })
    .eq("store_id", storeId)
    .eq("platform", PLATFORM);
  if (error) throw new Error(`Connection save failed: ${error.code}`);
}

export function productStepCount(productCount: number): number {
  return Math.ceil(productCount / PRODUCTS_PER_STEP);
}

export async function activeProductCount(storeId: string): Promise<number> {
  return (await listProducts(storeId)).length;
}

/** One batch of products, in the shop's currency. Saves the IDs right away, so a later failure keeps them. */
export async function syncProductBatch(storeId: string, batch: number): Promise<number> {
  const access = await shopAccess(storeId);
  const [shop, slug, known, all] = await Promise.all([platform().shopInfo(access), storeSlug(storeId), knownIds(storeId), listProducts(storeId)]);
  const products = all.slice(batch * PRODUCTS_PER_STEP, (batch + 1) * PRODUCTS_PER_STEP);

  const prepared: SyncProduct[] = await Promise.all(
    products.map(async (p) => {
      const minor = p.currency === shop.currency ? p.priceMinor : (await quote(p.priceMinor, p.currency, shop.currency)).chargeMinor;
      return {
        id: p.id,
        handle: productHandle(slug, p.id),
        name: p.name,
        description: p.description,
        price: minorToDecimal(minor, shop.currency),
        stock: p.stock,
        imageUrl: p.imageUrl,
      };
    }),
  );
  const ids = await platform().syncProducts(access, prepared, known.products);
  await saveIds(storeId, { ...known, products: { ...known.products, ...ids } });
  return prepared.length;
}

/** The collection, the pages, the theme handoff, and the result the seller sees. */
export async function finishSync(storeId: string, productCount: number): Promise<SyncResult> {
  const access = await shopAccess(storeId);
  const [kit, config, known, shop, products] = await Promise.all([
    getBrandKit(storeId),
    getDraftConfig(storeId),
    knownIds(storeId),
    platform().shopInfo(access),
    listProducts(storeId),
  ]);
  if (!kit) throw new Error("Store has no brand kit");

  const productIds = products.map((p) => known.products[p.id]).filter(Boolean);
  const collection = await platform().syncCollection(access, kit.name, known.collection, productIds);
  const pages = pagesFromStore(kit, config?.sections ?? []);
  const pageIds = await platform().syncPages(access, pages, known.pages);
  await saveIds(storeId, { ...known, collection, pages: { ...known.pages, ...pageIds } });

  const result: SyncResult = {
    at: new Date().toISOString(),
    products: productCount,
    pages: pages.length,
    shopDomain: access.shopDomain,
    storefrontUrl: shop.storefrontUrl,
    theme: await platform().themeHandoff(access, { palette: kit.palette, fonts: kit.fonts }),
  };
  const { error } = await serviceRoleClient()
    .from("platform_connections")
    .update({ last_synced_at: result.at, last_sync_result: result as unknown as Json })
    .eq("store_id", storeId)
    .eq("platform", PLATFORM);
  if (error) throw new Error(`Connection save failed: ${error.code}`);
  return result;
}

export async function recordSyncFailure(storeId: string, message: string): Promise<void> {
  const { error } = await serviceRoleClient()
    .from("platform_connections")
    .update({ last_sync_result: { at: new Date().toISOString(), error: message } })
    .eq("store_id", storeId)
    .eq("platform", PLATFORM);
  if (error) throw new Error(`Connection save failed: ${error.code}`);
}
