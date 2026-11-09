import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { autoTag, baseName, MAX_MEDIA_BYTES, normalizeTags, sniff, type MediaKind } from "./tags";

/**
 * The media library (spec v2, Design): one per account, shared across the owner's stores. Rows are read and written
 * with the caller's session client, so row-level security limits every query to the signed-in owner. The service-role
 * client only moves bytes in Storage, under a path that starts with the owner's id.
 */

type Db = SupabaseClient<Database>;
const BUCKET = "store-assets";

export class MediaError extends Error {
  constructor(
    public readonly code: "not_found" | "too_large" | "bad_type" | "empty" | "in_use" | "bad_input",
    message: string,
    public readonly detail?: string[],
  ) {
    super(message);
  }
}

export type MediaUse = { kind: "product" | "post" | "logo" | "reference"; storeId: string; label: string; href: string };
export type MediaItem = {
  id: string;
  name: string;
  url: string;
  kind: MediaKind;
  tags: string[];
  productIds: string[];
  storeId: string | null;
  source: string;
  createdAt: string;
};

const pathPrefix = (ownerId: string) => `owners/${ownerId}/media/`;

/** Name of the file as uploaded, kept in the storage path so the library can show it. */
function nameFromUrl(url: string): string {
  const last = decodeURIComponent(url.split("/").pop() ?? "");
  return last.replace(/^[0-9a-f-]{36}--/, "") || last;
}

function toItem(row: Database["public"]["Tables"]["media"]["Row"]): MediaItem {
  return {
    id: row.id,
    name: nameFromUrl(row.url),
    url: row.url,
    kind: row.kind === "document" ? "document" : "image",
    tags: row.tags,
    productIds: row.product_ids,
    storeId: row.store_id,
    source: row.source,
    createdAt: row.created_at,
  };
}

async function storeProducts(storeId: string) {
  const { data, error } = await serviceRoleClient().from("products").select("id, name, category").eq("store_id", storeId);
  if (error) throw new Error(`Product list failed: ${error.code}`);
  return data;
}

/**
 * Saves an upload to the library and tags it by type and product. `storeId` comes from the session or the thread,
 * never from the browser; null for an account thread, where there are no products to match.
 */
export async function uploadMedia(
  supabase: Db,
  ownerId: string,
  storeId: string | null,
  file: { bytes: Uint8Array; fileName: string; note?: string },
): Promise<MediaItem> {
  if (file.bytes.byteLength === 0) throw new MediaError("empty", "That file is empty.");
  if (file.bytes.byteLength > MAX_MEDIA_BYTES) throw new MediaError("too_large", "Files can be up to 4 MB.");
  const type = sniff(file.bytes);
  if (!type) throw new MediaError("bad_type", "Use a JPG, PNG, WebP or GIF image, or a PDF.");

  const note = (file.note ?? "").slice(0, 300);
  const { tags, productIds } = autoTag(file.fileName, note, type.kind, storeId ? await storeProducts(storeId) : []);
  const id = randomUUID();
  const safeName = (baseName(file.fileName).replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-") || "file").slice(0, 60);
  const path = `${pathPrefix(ownerId)}${id}--${safeName}.${type.ext}`;

  const storage = serviceRoleClient().storage.from(BUCKET);
  const { error: upErr } = await storage.upload(path, file.bytes, { contentType: type.mime, upsert: false });
  if (upErr) throw new Error("Media upload failed");
  const url = storage.getPublicUrl(path).data.publicUrl;

  const { data, error } = await supabase
    .from("media")
    .insert({ id, owner_id: ownerId, store_id: storeId, url, kind: type.kind, tags, product_ids: productIds, source: "upload" })
    .select("*")
    .single();
  if (error) {
    await storage.remove([path]);
    throw new Error(`Media save failed: ${error.code}`);
  }
  return toItem(data);
}

export async function listMedia(supabase: Db): Promise<MediaItem[]> {
  const { data, error } = await supabase.from("media").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(`Media list failed: ${error.code}`);
  return data.map(toItem);
}

/** Where each file is used across the owner's stores: product photos, posts, logo and brand references. */
export async function mediaUsage(supabase: Db, items: Pick<MediaItem, "id" | "url">[]): Promise<Map<string, MediaUse[]>> {
  const out = new Map<string, MediaUse[]>(items.map((i) => [i.id, []]));
  if (items.length === 0) return out;
  // Two library rows can hold the same file (a seeded copy and an upload), so a URL maps to every row with it.
  const byUrl = new Map<string, string[]>();
  for (const i of items) byUrl.set(i.url, [...(byUrl.get(i.url) ?? []), i.id]);
  const urls = [...byUrl.keys()];
  const [products, posts, stores] = await Promise.all([
    supabase.from("products").select("id, name, store_id, image_url").in("image_url", urls),
    supabase.from("posts").select("id, caption, store_id, media_url").in("media_url", urls),
    supabase.from("stores").select("id, slug, brand_kit"),
  ]);
  for (const r of [products, posts, stores]) if (r.error) throw new Error(`Media usage failed: ${r.error.code}`);
  const add = (url: string | null, use: MediaUse) => {
    for (const id of (url && byUrl.get(url)) || []) out.get(id)!.push(use);
  };
  for (const p of products.data!) add(p.image_url, { kind: "product", storeId: p.store_id, label: p.name, href: "/dashboard/store?tab=products" });
  for (const p of posts.data!)
    add(p.media_url, { kind: "post", storeId: p.store_id, label: (p.caption ?? "Post").slice(0, 60), href: "/dashboard/campaigns" });
  for (const s of stores.data!) {
    const kit = (s.brand_kit ?? {}) as { name?: string; logoUrl?: string | null; referenceImageUrls?: string[] };
    const label = kit.name ?? s.slug;
    add(kit.logoUrl ?? null, { kind: "logo", storeId: s.id, label, href: "/dashboard/design?tab=brand" });
    for (const ref of kit.referenceImageUrls ?? []) add(ref, { kind: "reference", storeId: s.id, label, href: "/dashboard/design?tab=brand" });
  }
  return out;
}

async function getOwn(supabase: Db, id: string) {
  const { data, error } = await supabase.from("media").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Media read failed: ${error.code}`);
  if (!data) throw new MediaError("not_found", "That file isn't in your library.");
  return data;
}

/** The seller fixes tags by hand. Tags stay labels: normalised, capped, never read as instructions. */
export async function setMediaTags(supabase: Db, id: string, tags: string[]): Promise<string[]> {
  await getOwn(supabase, id);
  const clean = normalizeTags(tags);
  const { error } = await supabase.from("media").update({ tags: clean }).eq("id", id);
  if (error) throw new Error(`Media update failed: ${error.code}`);
  return clean;
}

/** Refused while the file is in use, with the places listed, so a live product never loses its photo. */
export async function deleteMedia(supabase: Db, ownerId: string, id: string): Promise<void> {
  const row = await getOwn(supabase, id);
  const uses = (await mediaUsage(supabase, [{ id: row.id, url: row.url }])).get(row.id) ?? [];
  if (uses.length > 0) throw new MediaError("in_use", "This file is in use. Replace it there first.", uses.map((u) => `${u.kind}: ${u.label}`));
  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) throw new Error(`Media delete failed: ${error.code}`);
  const marker = `/object/public/${BUCKET}/`;
  const path = decodeURIComponent(row.url.split(marker)[1] ?? "");
  if (path.startsWith(pathPrefix(ownerId))) await serviceRoleClient().storage.from(BUCKET).remove([path]);
}

/** For Axori AI's context chips: one file of this store's, as data. */
export async function mediaForContext(storeId: string, id: string) {
  const { data, error } = await serviceRoleClient()
    .from("media")
    .select("id, url, kind, tags, product_ids")
    .eq("store_id", storeId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Media read failed: ${error.code}`);
  return data && { mediaId: data.id, file: nameFromUrl(data.url), kind: data.kind, tags: data.tags, productIds: data.product_ids, url: data.url };
}
