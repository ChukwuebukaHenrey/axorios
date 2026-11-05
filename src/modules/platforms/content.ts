import type { SyncPage } from "./types";

type Section = { type: string; hidden?: boolean; content: Record<string, unknown> };

export const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");

/**
 * Pages come only from what the store already says. A store with no FAQ gets no FAQ page, and no delivery page
 * is invented: AxoriOS never makes up a policy on the seller's behalf.
 */
export function pagesFromStore(brand: { name: string; tagline: string }, sections: Section[]): SyncPage[] {
  const visible = (type: string) => sections.find((s) => s.type === type && !s.hidden)?.content;

  const story = visible("story");
  const storyBody = typeof story?.body === "string" ? story.body : "";
  const pages: SyncPage[] = [
    { key: "about", title: `About ${brand.name}`, bodyHtml: `<p>${escapeHtml(brand.tagline)}</p>${paragraphs(storyBody)}` },
  ];

  const faq = visible("faq");
  const items = Array.isArray(faq?.items) ? (faq.items as { question?: unknown; answer?: unknown }[]) : [];
  const answered = items.filter((i) => typeof i.question === "string" && typeof i.answer === "string");
  if (answered.length > 0) {
    pages.push({
      key: "faq",
      title: "Questions",
      bodyHtml: answered.map((i) => `<h3>${escapeHtml(i.question as string)}</h3>${paragraphs(i.answer as string)}`).join(""),
    });
  }
  return pages;
}

/** Stable per product and store, and valid as a Shopify handle. */
export function productHandle(slug: string, productId: string): string {
  return `${slug}-${productId.slice(0, 8)}`.toLowerCase();
}

export const isShopDomain = (domain: string) => /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain);
