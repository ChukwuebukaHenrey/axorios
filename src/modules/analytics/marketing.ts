/**
 * Marketing performance (spec v2, Marketing → Performance). Pure: no I/O. Per post and per campaign:
 * reach and engagement from post_metrics, clicks from tracked links, and orders, revenue and new contacts
 * through the post's link. Orders through a link follow metrics.postConversions; revenue follows metrics.sales.
 */
import { isCounted, postConversions, sales, type MetricOrder, type Range } from "./metrics";

export type PerfPostInput = {
  id: string;
  created_at: string;
  scheduled_at: string | null;
  channel: string | null;
  targets: string[];
  content_type: string;
  caption: string;
  caption_length: number | null;
  campaign_id: string | null;
  link_id: string | null;
  product_ids: string[];
};
export type PerfMetricInput = { post_id: string; reach: number; impressions: number; engagements: number };
export type PerfClickInput = { link_id: string; clicks: number };
export type PerfLinkInput = { id: string; post_id: string | null; campaign_id: string | null };
export type PerfOrder = MetricOrder & { campaign_id?: string | null };

export type Totals = {
  posts: number;
  reach: number;
  engagements: number;
  clicks: number;
  orders: number;
  revenue: number; // store minor units
  newContacts: number;
};

export type PostPerf = Totals & {
  id: string;
  at: string;
  channel: string;
  contentType: string;
  length: LengthBucket | null;
  productIds: string[];
  campaignId: string | null;
  caption: string;
  linkId: string | null;
};

export type LengthBucket = "short" | "medium" | "long";

/** Caption length buckets, shared with Analytics: under 80 characters is short, under 200 medium. */
export function lengthBucket(chars: number | null): LengthBucket | null {
  if (chars === null) return null;
  return chars < 80 ? "short" : chars < 200 ? "medium" : "long";
}

/** Clicks over reach, orders over clicks. 0 when the bottom is 0. */
export const rate = (top: number, bottom: number) => (bottom > 0 ? top / bottom : 0);

const zero = (): Totals => ({ posts: 0, reach: 0, engagements: 0, clicks: 0, orders: 0, revenue: 0, newContacts: 0 });

function add(into: Totals, p: Totals) {
  into.posts += p.posts;
  into.reach += p.reach;
  into.engagements += p.engagements;
  into.clicks += p.clicks;
  into.orders += p.orders;
  into.revenue += p.revenue;
  into.newContacts += p.newContacts;
}

/** Each contact's first counted order. Whatever brought that order in brought the contact in. */
function firstOrders(orders: MetricOrder[]): MetricOrder[] {
  const first = new Map<string, MetricOrder>();
  for (const o of orders) {
    if (!isCounted(o) || !o.contact_id || !o.paid_at) continue;
    const cur = first.get(o.contact_id);
    if (!cur || Date.parse(o.paid_at) < Date.parse(cur.paid_at!)) first.set(o.contact_id, o);
  }
  return [...first.values()];
}

/** New contacts through one link: contacts whose first counted order came through it. */
export function newContactsFromLink(orders: MetricOrder[], linkId: string): number {
  return firstOrders(orders).filter((o) => o.link_id === linkId).length;
}

/** A post's time: when it went out (or was scheduled), else when it was made. */
export const postTime = (p: { scheduled_at: string | null; created_at: string }) => p.scheduled_at ?? p.created_at;

/**
 * One row per post that went out (or was made) in the range. A post's numbers are lifetime numbers:
 * an order placed after the range still counts for a post made inside it.
 */
export function postPerformance(input: {
  posts: PerfPostInput[];
  metrics: PerfMetricInput[];
  clicks: PerfClickInput[];
  orders: MetricOrder[];
  range?: Range;
}): PostPerf[] {
  const { range } = input;
  const reach = new Map<string, { reach: number; engagements: number }>();
  for (const m of input.metrics) {
    const v = reach.get(m.post_id) ?? { reach: 0, engagements: 0 };
    v.reach += m.reach;
    v.engagements += m.engagements;
    reach.set(m.post_id, v);
  }
  const clicks = new Map<string, number>();
  for (const c of input.clicks) clicks.set(c.link_id, (clicks.get(c.link_id) ?? 0) + c.clicks);

  const byLink = new Map<string, MetricOrder[]>();
  for (const o of input.orders) {
    if (!o.link_id || !isCounted(o)) continue;
    byLink.set(o.link_id, [...(byLink.get(o.link_id) ?? []), o]);
  }
  const newByLink = new Map<string, number>();
  for (const o of firstOrders(input.orders)) if (o.link_id) newByLink.set(o.link_id, (newByLink.get(o.link_id) ?? 0) + 1);

  return input.posts
    .filter((p) => {
      if (!range) return true;
      const t = Date.parse(postTime(p));
      return t >= range.from.getTime() && t < range.to.getTime();
    })
    .map((p) => {
      const m = reach.get(p.id) ?? { reach: 0, engagements: 0 };
      const linkOrders = (p.link_id && byLink.get(p.link_id)) || [];
      return {
        id: p.id,
        at: postTime(p),
        channel: p.channel ?? p.targets[0] ?? "",
        contentType: p.content_type,
        length: lengthBucket(p.caption_length ?? p.caption.length),
        productIds: p.product_ids,
        campaignId: p.campaign_id,
        caption: p.caption,
        linkId: p.link_id,
        posts: 1,
        reach: m.reach,
        engagements: m.engagements,
        clicks: p.link_id ? (clicks.get(p.link_id) ?? 0) : 0,
        orders: p.link_id ? postConversions(linkOrders, p.link_id) : 0,
        revenue: sales(linkOrders),
        newContacts: p.link_id ? (newByLink.get(p.link_id) ?? 0) : 0,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function totals(rows: Totals[]): Totals {
  const out = zero();
  for (const r of rows) add(out, r);
  return out;
}

export type Breakdown = Totals & { key: string };
export const BREAKDOWNS = ["channel", "contentType", "length", "product", "weekday", "daypart"] as const;
export type BreakdownBy = (typeof BREAKDOWNS)[number];
export const DAYPARTS = ["morning", "afternoon", "evening", "night"] as const;
export type Daypart = (typeof DAYPARTS)[number];

/** Local hour and weekday (0 = Sunday) in the store's time zone. */
function localParts(iso: string, timeZone: string): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(new Date(iso));
  const hour = Number(parts.find((x) => x.type === "hour")?.value ?? 0);
  const wd = parts.find((x) => x.type === "weekday")?.value ?? "Sun";
  return { hour, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd) };
}

/** 06–12 morning, 12–17 afternoon, 17–22 evening, otherwise night. */
export function daypart(hour: number): Daypart {
  return hour >= 6 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 22 ? "evening" : "night";
}

/**
 * Posts grouped by one attribute, sorted by orders then clicks. A post about two products counts toward
 * each product, so product rows can add up to more than the total. Keys are raw values; the page labels them.
 */
export function breakdown(rows: PostPerf[], by: BreakdownBy, timeZone = "UTC"): Breakdown[] {
  const groups = new Map<string, Totals>();
  const put = (key: string, r: PostPerf) => {
    const g = groups.get(key) ?? zero();
    add(g, r);
    groups.set(key, g);
  };
  for (const r of rows) {
    if (by === "product") {
      for (const id of r.productIds.length ? r.productIds : [""]) put(id, r);
      continue;
    }
    const key =
      by === "channel"
        ? r.channel
        : by === "contentType"
          ? r.contentType
          : by === "length"
            ? (r.length ?? "")
            : by === "weekday"
              ? String(localParts(r.at, timeZone).weekday)
              : daypart(localParts(r.at, timeZone).hour);
    put(key, r);
  }
  return [...groups].map(([key, t]) => ({ key, ...t })).sort((a, b) => b.orders - a.orders || b.clicks - a.clicks || a.key.localeCompare(b.key));
}

export type CampaignPerfInput = { id: string; name: string; kind: string; status: string; channels: string[]; scheduled_at: string | null; created_at: string; sends: number; sent: number };
export type CampaignPerf = Totals & CampaignPerfInput & { sources: "posts" | "orders" };

/**
 * Per campaign: its posts' totals. Orders and revenue are the campaign's own orders (orders.campaign_id)
 * when the campaign has any, as broadcasts have no post; otherwise the sum through its posts' links.
 */
export function campaignPerformance(campaigns: CampaignPerfInput[], posts: PostPerf[], orders: PerfOrder[]): CampaignPerf[] {
  const firstIds = new Set(firstOrders(orders).map((o) => o.id));
  return campaigns
    .map((c) => {
      const t = totals(posts.filter((p) => p.campaignId === c.id));
      const own = orders.filter((o) => isCounted(o) && o.campaign_id === c.id);
      if (own.length === 0) return { ...c, ...t, sources: "posts" as const };
      return {
        ...c,
        ...t,
        orders: own.length,
        revenue: sales(own),
        newContacts: own.filter((o) => firstIds.has(o.id)).length,
        sources: "orders" as const,
      };
    })
    .sort((a, b) => (b.scheduled_at ?? b.created_at).localeCompare(a.scheduled_at ?? a.created_at));
}

/** Store time zone from its country, for "time posted" breakdowns. Countries with one zone only; else UTC. */
const COUNTRY_TZ: Record<string, string> = {
  NG: "Africa/Lagos",
  GH: "Africa/Accra",
  KE: "Africa/Nairobi",
  ZA: "Africa/Johannesburg",
  EG: "Africa/Cairo",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  NL: "Europe/Amsterdam",
  ES: "Europe/Madrid",
  IT: "Europe/Rome",
  IN: "Asia/Kolkata",
  JP: "Asia/Tokyo",
  PH: "Asia/Manila",
  SG: "Asia/Singapore",
  AE: "Asia/Dubai",
  NZ: "Pacific/Auckland",
};
export function storeTimeZone(country: string | null | undefined): string {
  return (country && COUNTRY_TZ[country.toUpperCase()]) || "UTC";
}
