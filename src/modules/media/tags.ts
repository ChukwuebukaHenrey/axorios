/**
 * Media library rules (spec v2, Design): what an upload is, and the tags it gets. Pure, so it's tested without a database.
 * Tagging reads only the file name, the seller's own note and the store's product names. No model sees the file:
 * uploads are untrusted data, and a tag is a label the seller can fix, never an instruction.
 */

export const MAX_MEDIA_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request body limit
export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 32;

export type MediaKind = "image" | "document";
export type Sniffed = { mime: string; ext: string; kind: MediaKind };

/** The file's real type from its first bytes. The browser's claimed type and the name are ignored. SVG is refused (scripts). */
export function sniff(bytes: Uint8Array): Sniffed | null {
  const at = (i: number, ...b: number[]) => b.every((v, k) => bytes[i + k] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", ext: "png", kind: "image" };
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return { mime: "image/webp", ext: "webp", kind: "image" };
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return { mime: "image/gif", ext: "gif", kind: "image" };
  if (at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return { mime: "application/pdf", ext: "pdf", kind: "document" };
  return null;
}

/** Lower case, single spaces, letters and digits only. */
export function normText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function normalizeTags(tags: string[]): string[] {
  const out: string[] = [];
  for (const raw of tags) {
    const tag = normText(raw).slice(0, MAX_TAG_LENGTH).trim();
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

/** The file name without folders or extension, for display and tagging. */
export function baseName(fileName: string): string {
  const name = fileName.split(/[\\/]/).pop() ?? "";
  return name.replace(/\.[a-z0-9]{1,5}$/i, "").slice(0, 120);
}

const TYPE_RULES: [RegExp, string][] = [
  [/\blogo\b/, "logo"],
  [/\b(receipt|invoice)\b/, "receipt"],
  [/\b(screenshot|screen shot|screencap)\b/, "screenshot"],
  [/\b(inspo|inspiration|reference|ref|moodboard|mood)\b/, "reference"],
  [/\b(menu|price list|flyer|poster|banner)\b/, "graphic"],
];

/** One type tag: what the seller would call the file. */
export function typeTag(name: string, note: string, kind: MediaKind): string {
  const text = normText(`${name} ${note}`);
  for (const [re, tag] of TYPE_RULES) if (re.test(text)) return tag;
  return kind === "document" ? "document" : "photo";
}

/** Words too common in product names to tell products apart. */
const GENERIC = new Set(["cake", "cakes", "box", "jar", "gift", "pack", "set", "the", "and", "with", "for", "of", "a", "mini", "small", "large"]);

const productWords = (name: string) => normText(name).split(" ").filter((w) => w.length >= 3 && !GENERIC.has(w));

/**
 * A product matches when the name or note holds its whole name, every one of its distinctive words, or a word of
 * four letters or more that no other product in the store uses ("brownie" → Fudge Brownie Box).
 */
export function matchProducts<P extends { id: string; name: string }>(name: string, note: string, products: P[]): P[] {
  const words = new Set(normText(`${name} ${note}`).split(" "));
  const text = ` ${normText(`${name} ${note}`)} `;
  const uses = new Map<string, number>();
  for (const p of products) for (const w of new Set(productWords(p.name))) uses.set(w, (uses.get(w) ?? 0) + 1);
  return products.filter((p) => {
    const full = normText(p.name);
    if (full && text.includes(` ${full} `)) return true;
    const distinct = productWords(p.name);
    if (distinct.length > 0 && distinct.every((w) => words.has(w))) return true;
    return distinct.some((w) => w.length >= 4 && uses.get(w) === 1 && words.has(w));
  });
}

export type AutoTags = { tags: string[]; productIds: string[] };

/** Type tag first, then each matched product's name and category. */
export function autoTag<P extends { id: string; name: string; category?: string | null }>(
  fileName: string,
  note: string,
  kind: MediaKind,
  products: P[],
): AutoTags {
  const name = baseName(fileName);
  const matched = matchProducts(name, note, products);
  const tags = normalizeTags([typeTag(name, note, kind), ...matched.flatMap((p) => [p.name, p.category ?? ""])]);
  return { tags, productIds: matched.map((p) => p.id) };
}
