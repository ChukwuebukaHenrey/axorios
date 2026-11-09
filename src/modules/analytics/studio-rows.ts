/**
 * Plain rows for the Analytics workspace (AG Studio), built from the store-scoped loaders in data.ts.
 * Pure: no I/O. Money becomes major units of the store currency (charge-currency fields say so), using the same
 * per-order rules as metrics.ts, so summing `orders.sales` over a period gives exactly `sales()` for that period.
 */
import { currencyDecimals } from "../../lib/money";
import { chargeToStore, isCounted, lineSales } from "./metrics";
import { lengthBucket } from "./marketing";
import type {
  CampaignRow,
  ClickDayRow,
  ContactRow,
  ExpenseRow,
  ItemRow,
  LabelRow,
  LinkRow,
  MoneyOrder,
  PostMetricRow,
  PostRow,
  ProductRow,
  RefundRow,
} from "./data";

/** One PayPal Transaction Search row (same shape as payments' ProviderTransaction). */
export type PaypalTxn = {
  id: string;
  eventCode: string;
  status: string;
  at: string;
  amountMinor: number;
  feeMinor: number;
  currency: string;
  customId?: string;
};

export type StudioInput = {
  currency: string;
  now: Date;
  orders: MoneyOrder[];
  items: ItemRow[];
  products: ProductRow[];
  contacts: ContactRow[];
  labels: LabelRow[];
  refunds: RefundRow[];
  expenses: ExpenseRow[];
  posts: PostRow[];
  postMetrics: PostMetricRow[];
  campaigns: CampaignRow[];
  links: LinkRow[];
  clicks: ClickDayRow[];
  visits: { day: string; visits: number }[];
  /** null when PayPal's Transaction Search couldn't be read: the grid falls back to stored capture data. */
  paypal: PaypalTxn[] | null;
  names: {
    channel: Record<string, string>;
    status: Record<string, string>;
    match: Record<MatchKey, string>;
  };
};

export type MatchKey =
  | "matched"
  | "mismatch"
  | "imported"
  | "noCapture"
  | "stored"
  | "pending"
  | "outside"
  | "missing"
  | "notOurs";

const SEARCH_DAYS = 31;
const LENGTH_LABEL: Record<string, string> = { short: "Short", medium: "Medium", long: "Long" };
const LAG_MS = 3 * 3_600_000;

export function buildStudioRows(input: StudioInput) {
  const { currency, orders, names } = input;
  const major = (minor: number, cur = currency) =>
    minor / 10 ** currencyDecimals(cur);
  const channel = (c: string | null) => (c ? (names.channel[c] ?? c) : "");
  const counted = orders.filter(isCounted);
  const countedIds = new Set(counted.map((o) => o.id));

  // First counted order per contact, for "repeat" (same rule as metrics.repeatRate).
  const first = new Map<string, number>();
  for (const o of counted) {
    if (!o.contact_id || !o.paid_at) continue;
    const t = Date.parse(o.paid_at);
    if (t < (first.get(o.contact_id) ?? Infinity)) first.set(o.contact_id, t);
  }

  // PayPal match per capture id: sales only (positive amounts).
  const byCapture = new Map<string, PaypalTxn>();
  for (const t of input.paypal ?? [])
    if (t.amountMinor > 0) byCapture.set(t.id, t);
  const windowStart = input.now.getTime() - SEARCH_DAYS * 86_400_000;
  const matchOf = (o: MoneyOrder): MatchKey => {
    if (o.source === "import" || o.source === "seed") return "imported";
    if (!o.paypal_capture_id) return "noCapture";
    if (input.paypal === null) return "stored";
    const t = byCapture.get(o.paypal_capture_id);
    if (t)
      return t.amountMinor === o.charge_total_minor &&
        t.currency === o.charge_currency
        ? "matched"
        : "mismatch";
    const paid = Date.parse(o.paid_at!);
    if (paid > input.now.getTime() - LAG_MS) return "pending";
    if (paid < windowStart) return "outside";
    return "missing";
  };

  const orderRows = counted.map((o) => {
    const salesMinor = o.total_minor - o.refunded_minor;
    const feeStore = chargeToStore(o, o.paypal_fee_minor ?? 0);
    const vatMinor =
      o.total_minor === 0
        ? 0
        : Math.round((o.tax_minor * salesMinor) / o.total_minor);
    const repeat =
      !!o.contact_id &&
      Date.parse(o.paid_at!) > (first.get(o.contact_id) ?? Infinity);
    const match = matchOf(o);
    return {
      id: o.id,
      number: o.id.slice(0, 8).toUpperCase(),
      paidAt: o.paid_at!,
      status: names.status[o.status] ?? o.status,
      channel: channel(o.channel),
      source: o.source,
      contactId: o.contact_id ?? "",
      campaignId: o.campaign_id ?? "",
      linkId: o.link_id ?? "",
      buyerCountry: o.buyer_country ?? "",
      abroad: !!o.buyer_country && o.charge_currency !== o.currency,
      customerType: repeat ? "Repeat" : "New",
      one: 1,
      repeat: repeat ? 1 : 0,
      hasRefund: o.refunded_minor > 0 ? 1 : 0,
      total: major(o.total_minor),
      refunded: major(o.refunded_minor),
      sales: major(salesMinor),
      fee: major(feeStore),
      net: major(salesMinor - feeStore),
      vat: major(vatMinor),
      chargeCurrency: o.charge_currency,
      chargeTotal: major(o.charge_total_minor, o.charge_currency),
      chargeFee: major(o.paypal_fee_minor ?? 0, o.charge_currency),
      chargeNet:
        o.paypal_net_minor === null
          ? null
          : major(o.paypal_net_minor, o.charge_currency),
      chargeRefunded: major(o.refunded_charge_minor ?? 0, o.charge_currency),
      /** Store units per charged unit (₦ per $), the way sellers quote rates. 1 when no conversion. */
      fxRate:
        o.fx_rate && o.charge_currency !== o.currency
          ? Math.round((1 / o.fx_rate) * 100) / 100
          : 1,
      fxSource:
        o.fx_source ??
        (o.charge_currency === o.currency ? "Same currency" : ""),
      captureId: o.paypal_capture_id ?? "",
      paypalMatch: names.match[match],
      mismatch: match === "mismatch" || match === "missing",
    };
  });

  const orderById = new Map(counted.map((o) => [o.id, o]));
  const items = input.items
    .filter((i) => countedIds.has(i.order_id))
    .map((i, n) => ({
      id: `${i.order_id}:${n}`,
      orderId: i.order_id,
      productId: i.product_id ?? "",
      product: i.name ?? "",
      quantity: i.quantity,
      revenue: major(lineSales(i, orderById.get(i.order_id)!)),
    }));

  const labelName = new Map(input.labels.map((l) => [l.id, l.name]));
  const systemLabel = new Set(
    input.labels.filter((l) => l.system).map((l) => l.id),
  );
  const userLabels = (ids: string[]) =>
    ids
      .filter((id) => !systemLabel.has(id))
      .map((id) => labelName.get(id)!)
      .filter(Boolean)
      .sort();
  const buyers = new Set(counted.map((o) => o.contact_id).filter(Boolean));
  const customers = input.contacts
    .filter((c) => !c.merged_into)
    .map((c) => ({
      id: c.id,
      name: c.name ?? c.email ?? c.telegram_username ?? "Unnamed",
      country: c.country ?? "",
      source: c.source,
      firstSeen: c.first_seen_at,
      type: buyers.has(c.id) ? "Customer" : "Lead",
      labels: userLabels(c.label_ids).join(", "),
      label: userLabels(c.label_ids)[0] ?? "No label",
    }));

  const products = input.products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category ?? "",
    inventoryMode: p.inventory_mode,
    stock: p.stock,
    price: major(p.price_minor),
    active: p.active,
  }));

  const refunds = input.refunds.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    at: r.created_at,
    amount: major(r.store_amount_minor),
    vatReversed: major(r.vat_reversed_minor),
    status: r.status,
    reason: r.reason ?? "",
  }));

  const expenses = input.expenses
    .filter((e) => e.currency === currency)
    .map((e) => ({
      id: e.id,
      day: e.day,
      category: e.category,
      note: e.note ?? "",
      amount: major(e.amount_minor),
    }));

  // Posts: platform metrics summed, plus orders and revenue through the post's tracked link (metrics.postConversions rule).
  const perLink = new Map<string, { orders: number; revenue: number }>();
  for (const o of counted) {
    if (!o.link_id) continue;
    const v = perLink.get(o.link_id) ?? { orders: 0, revenue: 0 };
    v.orders += 1;
    v.revenue += o.total_minor - o.refunded_minor;
    perLink.set(o.link_id, v);
  }
  const perPost = new Map<
    string,
    { reach: number; impressions: number; engagements: number }
  >();
  for (const m of input.postMetrics) {
    const v = perPost.get(m.post_id) ?? {
      reach: 0,
      impressions: 0,
      engagements: 0,
    };
    v.reach += m.reach;
    v.impressions += m.impressions;
    v.engagements += m.engagements;
    perPost.set(m.post_id, v);
  }
  const clicksPerLink = new Map<string, number>();
  for (const c of input.clicks)
    clicksPerLink.set(
      c.link_id,
      (clicksPerLink.get(c.link_id) ?? 0) + c.clicks,
    );
  const productName = new Map(input.products.map((p) => [p.id, p.name]));
  const posts = input.posts.map((p) => {
    const m = perPost.get(p.id) ?? { reach: 0, impressions: 0, engagements: 0 };
    const l = (p.link_id && perLink.get(p.link_id)) || {
      orders: 0,
      revenue: 0,
    };
    return {
      id: p.id,
      at: p.scheduled_at ?? p.created_at,
      channel: channel(p.channel ?? p.targets[0] ?? null),
      contentType: p.content_type,
      length: LENGTH_LABEL[lengthBucket(p.caption_length) ?? ""] ?? "",
      product: p.product_ids
        .map((id) => productName.get(id))
        .filter(Boolean)
        .join(", "),
      campaignId: p.campaign_id ?? "",
      caption: p.caption.slice(0, 80),
      reach: m.reach,
      impressions: m.impressions,
      engagements: m.engagements,
      clicks: p.link_id ? (clicksPerLink.get(p.link_id) ?? 0) : 0,
      orders: l.orders,
      revenue: major(l.revenue),
    };
  });

  const perCampaign = new Map<string, { orders: number; revenue: number }>();
  for (const o of counted) {
    if (!o.campaign_id) continue;
    const v = perCampaign.get(o.campaign_id) ?? { orders: 0, revenue: 0 };
    v.orders += 1;
    v.revenue += o.total_minor - o.refunded_minor;
    perCampaign.set(o.campaign_id, v);
  }
  const campaigns = input.campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    status: c.status,
    channels: c.channels.map(channel).join(", "),
    scheduledAt: c.scheduled_at ?? c.created_at,
    sends: c.sends,
    sent: c.sent,
    skipped: c.skipped,
    orders: perCampaign.get(c.id)?.orders ?? 0,
    revenue: major(perCampaign.get(c.id)?.revenue ?? 0),
  }));

  const linkById = new Map(input.links.map((l) => [l.id, l]));
  const clicks = input.clicks.map((c, n) => {
    const l = linkById.get(c.link_id);
    return {
      id: String(n),
      day: c.day,
      postId: l?.post_id ?? "",
      campaignId: l?.campaign_id ?? "",
      channel: channel(l?.channel ?? null),
      country: c.country ?? "",
      device: c.device ?? "",
      clicks: c.clicks,
    };
  });

  const visits = input.visits.map((v) => ({ day: v.day, visits: v.visits }));

  const orderByCapture = new Map(
    counted
      .filter((o) => o.paypal_capture_id)
      .map((o) => [o.paypal_capture_id!, o]),
  );
  const paypal = (input.paypal ?? []).map((t) => {
    const o =
      orderByCapture.get(t.id) ??
      (t.customId ? counted.find((x) => x.id === t.customId) : undefined);
    const ok =
      o && t.amountMinor > 0
        ? t.amountMinor === o.charge_total_minor &&
          t.currency === o.charge_currency
        : !!o;
    return {
      id: t.id,
      at: t.at,
      eventCode: t.eventCode,
      status: t.status,
      currency: t.currency,
      amount: major(t.amountMinor, t.currency),
      fee: major(t.feeMinor, t.currency),
      orderNumber: o ? o.id.slice(0, 8).toUpperCase() : "",
      match: o ? names.match[ok ? "matched" : "mismatch"] : names.match.notOurs,
    };
  });

  const dates = [
    ...orderRows.map((o) => o.paidAt),
    ...posts.map((p) => p.at),
    ...visits.map((v) => v.day),
  ]
    .map((d) => d.slice(0, 10))
    .sort();
  const settlement = [...new Set(orderRows.map((o) => o.chargeCurrency))];

  return {
    currency,
    chargeCurrency: settlement.length === 1 ? settlement[0] : null,
    range: {
      from: dates[0] ?? input.now.toISOString().slice(0, 10),
      to: input.now.toISOString().slice(0, 10),
    },
    paypalLive: input.paypal !== null,
    orders: orderRows,
    items,
    products,
    customers,
    refunds,
    expenses,
    posts,
    campaigns,
    clicks,
    visits,
    paypal,
  };
}

export type StudioRows = ReturnType<typeof buildStudioRows>;
