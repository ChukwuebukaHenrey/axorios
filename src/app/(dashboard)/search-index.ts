import { t } from "@/lib/messages";

/** One place search can take the seller: a page, or a view inside one that the sidebar doesn't list. */
export type Destination = { href: string; label: string; section: string; keywords: string };

const n = t.app.nav;
const s = t.app.settings.sections;

function views<K extends string>(section: string, base: string, param: string, labels: Record<K, string>, extra: Partial<Record<K, string>> = {}) {
  return (Object.keys(labels) as K[]).map((key, i) => ({
    href: i === 0 ? base : `${base}?${param}=${key}`,
    label: labels[key],
    section,
    keywords: `${section} ${labels[key]} ${extra[key] ?? ""}`.toLowerCase(),
  }));
}

/**
 * Every destination search knows, nested views included. Keywords hold the words a seller is likely
 * to type for a view whose label says something else ("payout" finds Withdrawals).
 */
export const DESTINATIONS: Destination[] = [
  { href: "/dashboard", label: n.home, section: n.home, keywords: "home overview dashboard summary today" },
  { href: "/dashboard/ai", label: n.ai, section: n.ai, keywords: "axori ai assistant chat new chat ask agent" },
  ...views(n.store, "/dashboard/store", "tab", t.app.store.tabs, {
    overview: "storefront visits conversion live store preview",
    products: "inventory stock low stock catalog items sku price",
    promotions: "discount coupon promo sale offer",
    context: "context details about business ai knowledge faq delivery policies hours",
  }),
  { href: "/dashboard/orders", label: n.orders, section: n.orders, keywords: "orders sales transactions fulfil fulfillment deliveries" },
  { href: "/dashboard/orders?status=paid", label: `${n.orders} · Paid`, section: n.orders, keywords: "paid orders captured" },
  { href: "/dashboard/orders?status=refunded", label: `${n.orders} · Refunded`, section: n.orders, keywords: "refund refunded returns" },
  ...views(n.customers, "/dashboard/customers", "tab", t.app.customers.tabs, { contacts: "buyers clients people", labels: "tags segments", duplicates: "merge duplicate" }),
  { href: "/dashboard/inbox", label: n.inbox, section: n.inbox, keywords: "inbox messages chats conversations telegram whatsapp unanswered" },
  ...views(n.marketing, "/dashboard/campaigns", "tab", t.app.marketing.tabs, {
    posts: "social posts creatives captions images",
    campaigns: "campaign schedule",
    performance: "clicks engagement marketing results performance",
  }),
  ...views(n.money, "/dashboard/money", "tab", t.app.money.tabs, {
    overview: "balance revenue finance paypal available",
    in: "income payments received sales audit transaction history",
    out: "refunds fees payments out",
    expenses: "costs spending",
    withdrawals: "payouts withdraw settlement bank",
    vat: "tax vat",
    statements: "statement monthly report pdf download",
  }),
  { href: "/dashboard/analytics", label: n.analytics, section: n.analytics, keywords: "analytics total revenue aov average order value net charts reports trends" },
  ...views(n.design, "/dashboard/design", "tab", t.app.design.tabs, { media: "images photos assets library uploads", brand: "logo colours colors fonts brand kit", templates: "themes templates storefront look" }),
  ...(Object.keys(s) as (keyof typeof s)[]).map((key) => ({
    href: `/dashboard/settings?section=${key}`,
    label: s[key],
    section: n.settings,
    keywords: `settings ${s[key]} ${key === "connections" ? "shopify zapier telegram integrations apps" : ""} ${key === "security" ? "password log out sign out sessions" : ""}`.toLowerCase(),
  })),
];

/** Destinations ranked by how well they match the query: label start, label word, then keywords. */
export function findDestinations(query: string, limit = 8): Destination[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return DESTINATIONS.map((d) => {
    const label = d.label.toLowerCase();
    const hay = `${label} ${d.keywords}`;
    if (!words.every((w) => hay.includes(w))) return null;
    const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2;
    return { d, score };
  })
    .filter((x): x is { d: Destination; score: number } => x !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => x.d);
}
