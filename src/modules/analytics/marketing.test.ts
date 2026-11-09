import { describe, expect, it } from "vitest";
import { breakdown, campaignPerformance, daypart, lengthBucket, newContactsFromLink, postPerformance, totals, type PerfOrder, type PerfPostInput } from "./marketing";
import { postConversions, sales } from "./metrics";

let n = 0;
function order(p: Partial<PerfOrder>): PerfOrder {
  return {
    id: `o${n++}`,
    status: "paid",
    source: "seed",
    channel: "web",
    currency: "NGN",
    total_minor: 4_500_000,
    refunded_minor: 0,
    tax_minor: 0,
    charge_currency: "NGN",
    charge_total_minor: 4_500_000,
    fx_rate: null,
    paypal_fee_minor: null,
    paid_at: "2026-11-01T10:00:00Z",
    contact_id: null,
    link_id: null,
    campaign_id: null,
    ...p,
  };
}
function post(p: Partial<PerfPostInput>): PerfPostInput {
  return {
    id: `p${n++}`,
    created_at: "2026-10-30T08:00:00Z",
    scheduled_at: null,
    channel: "instagram",
    targets: [],
    content_type: "image",
    caption: "Ube coconut cake, fresh today.",
    caption_length: 30,
    campaign_id: null,
    link_id: null,
    product_ids: [],
    ...p,
  };
}

describe("marketing performance", () => {
  const a = post({ id: "a", link_id: "L1", product_ids: ["ube", "red"], scheduled_at: "2026-10-31T18:30:00Z", campaign_id: "C1" });
  const b = post({ id: "b", link_id: "L2", channel: "tiktok", content_type: "carousel", caption_length: 250, product_ids: ["red"], campaign_id: "C1" });
  const c = post({ id: "c", channel: "google", content_type: "text" }); // no link
  const orders = [
    order({ link_id: "L1", contact_id: "k1", paid_at: "2026-11-01T10:00:00Z" }),
    order({ link_id: "L1", contact_id: "k2", status: "partially_refunded", refunded_minor: 500_000 }),
    order({ link_id: "L1", contact_id: "k3", status: "pending", paid_at: null }), // not counted
    order({ link_id: "L1", source: "test" }), // never counted
    order({ link_id: "L2", contact_id: "k1", paid_at: "2026-11-02T10:00:00Z" }), // k1 is not new here
    order({ link_id: null, contact_id: "k4", paid_at: "2026-10-01T10:00:00Z" }),
    order({ link_id: "L2", contact_id: "k4", paid_at: "2026-11-03T10:00:00Z" }), // k4 came earlier, not new
  ];
  const rows = postPerformance({
    posts: [a, b, c],
    metrics: [
      { post_id: "a", reach: 1000, impressions: 1500, engagements: 40 },
      { post_id: "a", reach: 500, impressions: 600, engagements: 10 },
      { post_id: "b", reach: 3000, impressions: 4000, engagements: 90 },
    ],
    clicks: [
      { link_id: "L1", clicks: 12 },
      { link_id: "L1", clicks: 3 },
      { link_id: "L2", clicks: 30 },
    ],
    orders,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  it("post orders equal metrics.postConversions for the post's link", () => {
    expect(byId.get("a")!.orders).toBe(postConversions(orders, "L1"));
    expect(byId.get("a")!.orders).toBe(2);
    expect(byId.get("b")!.orders).toBe(postConversions(orders, "L2"));
    expect(byId.get("c")!.orders).toBe(0);
  });

  it("revenue is metrics.sales over the link's orders, refunds taken off", () => {
    expect(byId.get("a")!.revenue).toBe(sales(orders.filter((o) => o.link_id === "L1")));
    expect(byId.get("a")!.revenue).toBe(8_500_000);
  });

  it("sums reach, engagement and clicks per post", () => {
    expect(byId.get("a")).toMatchObject({ reach: 1500, engagements: 50, clicks: 15 });
    expect(byId.get("c")).toMatchObject({ reach: 0, clicks: 0 });
  });

  it("counts a new contact only when their first order came through the link", () => {
    expect(byId.get("a")!.newContacts).toBe(2);
    expect(byId.get("b")!.newContacts).toBe(0);
    expect(newContactsFromLink(orders, "L1")).toBe(2);
  });

  it("filters posts to the range by when they went out", () => {
    const r = postPerformance({ posts: [a, b, c], metrics: [], clicks: [], orders, range: { from: new Date("2026-10-31T00:00:00Z"), to: new Date("2026-11-01T00:00:00Z") } });
    expect(r.map((x) => x.id)).toEqual(["a"]);
  });

  it("breaks down by channel, type, length, product and time", () => {
    expect(breakdown(rows, "channel").map((x) => [x.key, x.orders])).toEqual([["tiktok", 2], ["instagram", 2], ["google", 0]]);
    expect(breakdown(rows, "contentType").find((x) => x.key === "carousel")!.clicks).toBe(30);
    expect(breakdown(rows, "length").map((x) => x.key).sort()).toEqual(["long", "short"]);
    const prod = breakdown(rows, "product");
    expect(prod.find((x) => x.key === "red")!.posts).toBe(2); // a and b both feature it
    expect(prod.find((x) => x.key === "")!.posts).toBe(1); // c has no product
    // a went out 18:30 UTC = 19:30 in Lagos: evening, Saturday.
    expect(breakdown([byId.get("a")!], "daypart", "Africa/Lagos")[0].key).toBe("evening");
    expect(breakdown([byId.get("a")!], "weekday", "Africa/Lagos")[0].key).toBe("6");
  });

  it("totals add every post", () => {
    expect(totals(rows)).toMatchObject({ posts: 3, clicks: 45, orders: 4, reach: 4500 });
  });

  it("campaigns use their own orders when they have them, else their posts' links", () => {
    const base = { kind: "promo", status: "sent", channels: [], scheduled_at: null, created_at: "2026-10-01T00:00:00Z", sends: 0, sent: 0 };
    const campOrders = [...orders, order({ campaign_id: "C2", contact_id: "k9" }), order({ campaign_id: "C2", contact_id: "k1" })];
    const [c1, c2] = campaignPerformance(
      [
        { ...base, id: "C1", name: "Birthday season", created_at: "2026-10-02T00:00:00Z" },
        { ...base, id: "C2", name: "Restock broadcast" },
      ],
      rows,
      campOrders,
    );
    expect(c1).toMatchObject({ id: "C1", posts: 2, orders: 4, clicks: 45, sources: "posts" });
    expect(c2).toMatchObject({ id: "C2", posts: 0, orders: 2, revenue: 9_000_000, newContacts: 1, sources: "orders" });
  });

  it("length buckets and dayparts", () => {
    expect([lengthBucket(null), lengthBucket(79), lengthBucket(80), lengthBucket(199), lengthBucket(200)]).toEqual([null, "short", "medium", "medium", "long"]);
    expect([daypart(5), daypart(6), daypart(12), daypart(17), daypart(22)]).toEqual(["night", "morning", "afternoon", "evening", "night"]);
  });
});
