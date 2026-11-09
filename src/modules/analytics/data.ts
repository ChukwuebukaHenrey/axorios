import "server-only";
import { cache } from "react";
import { parseToMinor } from "@/lib/money";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import type { MetricOrder } from "./metrics";

/**
 * Server loaders for the numbers pages (Home, Money, Store, Analytics). Every function takes the session's
 * storeId; nothing here accepts a store from the browser. Test orders (`source = 'test'`) never load.
 */

export type MoneyOrder = MetricOrder & {
  created_at: string;
  paypal_net_minor: number | null;
  paypal_capture_id: string | null;
  tax_rate_bp: number;
  buyer_country: string | null;
  fx_source: string | null;
  campaign_id: string | null;
  refunded_charge_minor: number;
  fulfilled_at: string | null;
};

const ORDER_COLUMNS =
  "id, status, source, channel, currency, total_minor, refunded_minor, tax_minor, tax_rate_bp, charge_currency, charge_total_minor, fx_rate, paypal_fee_minor, paypal_net_minor, paypal_capture_id, paid_at, contact_id, link_id, created_at, buyer_country, fx_source, campaign_id, refunded_charge_minor, fulfilled_at";

const PAGE = 1000;

/** Every row of a store-scoped query, a page at a time. PostgREST paging needs a stable order (by id). */
async function all<T>(
  run: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { code: string } | null }>,
  what: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(`${what} read failed: ${error.code}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Orders that were paid at some point (the ones metrics count), once per request. */
export const loadMetricOrders = cache(
  async (storeId: string): Promise<MoneyOrder[]> =>
    all<MoneyOrder>(
      (from, to) =>
        serviceRoleClient()
          .from("orders")
          .select(ORDER_COLUMNS)
          .eq("store_id", storeId)
          .neq("source", "test")
          .not("paid_at", "is", null)
          .order("id")
          .range(from, to),
      "Orders",
    ),
);

export type RefundRow = {
  id: string;
  order_id: string;
  amount_minor: number;
  currency: string;
  store_amount_minor: number;
  vat_reversed_minor: number;
  fee_returned_minor: number | null;
  status: string;
  reason: string | null;
  requested_by: string;
  created_at: string;
};

/** Refunds on this store's counted orders (refunds of hidden test orders are left out). */
export const loadRefunds = cache(
  async (storeId: string): Promise<RefundRow[]> => {
    const [rows, orders] = await Promise.all([
      all<RefundRow>(
        (from, to) =>
          serviceRoleClient()
            .from("refunds")
            .select(
              "id, order_id, amount_minor, currency, store_amount_minor, vat_reversed_minor, fee_returned_minor, status, reason, requested_by, created_at",
            )
            .eq("store_id", storeId)
            .order("id")
            .range(from, to),
        "Refunds",
      ),
      loadMetricOrders(storeId),
    ]);
    const known = new Set(orders.map((o) => o.id));
    return rows.filter((r) => known.has(r.order_id));
  },
);

export type ExpenseRow = {
  id: string;
  day: string;
  amount_minor: number;
  currency: string;
  category: string;
  note: string | null;
  source: string;
};

export const loadExpenses = cache(
  async (storeId: string): Promise<ExpenseRow[]> =>
    all<ExpenseRow>(
      (from, to) =>
        serviceRoleClient()
          .from("expenses")
          .select("id, day, amount_minor, currency, category, note, source")
          .eq("store_id", storeId)
          .order("id")
          .range(from, to),
      "Expenses",
    ),
);

export type WithdrawalRow = {
  id: string;
  day: string;
  usd_minor: number;
  ngn_minor: number;
  rate: number;
  provider: string;
  reference: string | null;
  source: string;
};

export const loadWithdrawals = cache(
  async (storeId: string): Promise<WithdrawalRow[]> =>
    all<WithdrawalRow>(
      (from, to) =>
        serviceRoleClient()
          .from("withdrawals")
          .select(
            "id, day, usd_minor, ngn_minor, rate, provider, reference, source",
          )
          .eq("store_id", storeId)
          .order("id")
          .range(from, to),
      "Withdrawals",
    ),
);

/** Store visits summed over [from, to) by day. */
export const loadVisits = cache(
  async (storeId: string): Promise<{ day: string; visits: number }[]> => {
    const rows = await all<{ day: string; visits: number }>(
      (from, to) =>
        serviceRoleClient()
          .from("store_visits")
          .select("day, visits")
          .eq("store_id", storeId)
          .order("day")
          .order("path")
          .range(from, to),
      "Visits",
    );
    const byDay = new Map<string, number>();
    for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.visits);
    return [...byDay]
      .map(([day, visits]) => ({ day, visits }))
      .sort((a, b) => (a.day < b.day ? -1 : 1));
  },
);

/**
 * Saves an expense the seller approved in Axori AI (spec v2, Money › Expenses). Store currency, from the store row.
 * Only called from an approval-gated tool.
 */
export async function logExpense(
  storeId: string,
  input: {
    amount: string;
    category: string;
    note?: string;
    day?: string;
    approvalId: string;
  },
) {
  const db = serviceRoleClient();
  const { data: store, error } = await db
    .from("stores")
    .select("currency, owner_id")
    .eq("id", storeId)
    .single();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  const day = input.day ?? new Date().toISOString().slice(0, 10);
  const { data: row, error: insertError } = await db
    .from("expenses")
    .insert({
      store_id: storeId,
      day,
      amount_minor: parseToMinor(input.amount, store.currency),
      currency: store.currency,
      category: input.category,
      note: input.note ?? null,
      source: "chat",
    })
    .select("id, day, amount_minor, currency, category")
    .single();
  if (insertError) throw new Error(`Expense save failed: ${insertError.code}`);
  await db
    .from("activity_log")
    .insert({
      owner_id: store.owner_id,
      store_id: storeId,
      actor: "axori_ai",
      action: "log_expense",
      target: row.id,
      approval_id: input.approvalId,
      details: row,
    });
  return row;
}

// ─── Catalogue, customers and marketing (Analytics, Home, Store, Customers, Marketing) ───

export type ItemRow = {
  order_id: string;
  product_id: string | null;
  name: string | null;
  quantity: number;
  line_minor: number;
};

/** Order lines of counted orders (the `order_items` view), test orders left out. */
export const loadOrderItems = cache(
  async (storeId: string): Promise<ItemRow[]> =>
    all<ItemRow>(
      (from, to) =>
        serviceRoleClient()
          .from("order_items")
          .select("order_id, product_id, name, quantity, line_minor")
          .eq("store_id", storeId)
          .neq("source", "test")
          .not("paid_at", "is", null)
          .order("order_id")
          .order("product_id")
          .order("quantity")
          .range(from, to),
      "Order items",
    ),
);

export type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  inventory_mode: string;
  stock: number;
  low_stock_threshold: number;
  daily_capacity: number | null;
  price_minor: number;
  currency: string;
  active: boolean;
  image_url: string | null;
};

export const loadProducts = cache(
  async (storeId: string): Promise<ProductRow[]> =>
    all<ProductRow>(
      (from, to) =>
        serviceRoleClient()
          .from("products")
          .select(
            "id, name, category, inventory_mode, stock, low_stock_threshold, daily_capacity, price_minor, currency, active, image_url",
          )
          .eq("store_id", storeId)
          .order("id")
          .range(from, to),
      "Products",
    ),
);

export type LabelRow = {
  id: string;
  name: string;
  colour: string;
  system: boolean;
};
export type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegram_username: string | null;
  country: string | null;
  source: string;
  first_seen_at: string;
  merged_into: string | null;
  label_ids: string[];
};

export const loadLabels = cache(async (storeId: string): Promise<LabelRow[]> =>
  all<LabelRow>(
    (from, to) =>
      serviceRoleClient()
        .from("labels")
        .select("id, name, colour, system")
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    "Labels",
  ),
);

/** Contacts with their label ids. Merged contacts are kept (merged_into set) so old orders still resolve. */
export const loadContacts = cache(
  async (storeId: string): Promise<ContactRow[]> => {
    const [rows, links] = await Promise.all([
      all<Omit<ContactRow, "label_ids">>(
        (from, to) =>
          serviceRoleClient()
            .from("contacts")
            .select(
              "id, name, email, phone, telegram_username, country, source, first_seen_at, merged_into",
            )
            .eq("store_id", storeId)
            .order("id")
            .range(from, to),
        "Contacts",
      ),
      all<{ contact_id: string; label_id: string }>(
        (from, to) =>
          serviceRoleClient()
            .from("contact_labels")
            .select("contact_id, label_id")
            .eq("store_id", storeId)
            .order("contact_id")
            .order("label_id")
            .range(from, to),
        "Contact labels",
      ),
    ]);
    const byContact = new Map<string, string[]>();
    for (const l of links)
      byContact.set(l.contact_id, [
        ...(byContact.get(l.contact_id) ?? []),
        l.label_id,
      ]);
    return rows.map((r) => ({ ...r, label_ids: byContact.get(r.id) ?? [] }));
  },
);

export type PostRow = {
  id: string;
  created_at: string;
  scheduled_at: string | null;
  status: string;
  channel: string | null;
  targets: string[];
  content_type: string;
  caption: string;
  caption_length: number | null;
  campaign_id: string | null;
  link_id: string | null;
  product_ids: string[];
  source: string;
};
export type PostMetricRow = {
  post_id: string;
  channel: string;
  day: string;
  reach: number;
  impressions: number;
  engagements: number;
  clicks: number;
};

export const loadPosts = cache(async (storeId: string): Promise<PostRow[]> =>
  all<PostRow>(
    (from, to) =>
      serviceRoleClient()
        .from("posts")
        .select(
          "id, created_at, scheduled_at, status, channel, targets, content_type, caption, caption_length, campaign_id, link_id, product_ids, source",
        )
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    "Posts",
  ),
);

export const loadPostMetrics = cache(
  async (storeId: string): Promise<PostMetricRow[]> =>
    all<PostMetricRow>(
      (from, to) =>
        serviceRoleClient()
          .from("post_metrics")
          .select(
            "post_id, channel, day, reach, impressions, engagements, clicks",
          )
          .eq("store_id", storeId)
          .order("post_id")
          .order("channel")
          .order("day")
          .range(from, to),
      "Post metrics",
    ),
);

export type CampaignRow = {
  id: string;
  name: string;
  kind: string;
  status: string;
  channels: string[];
  segment: string[];
  scheduled_at: string | null;
  created_at: string;
  sends: number;
  sent: number;
  skipped: number;
};

/** Campaigns with their send counts. */
export const loadCampaigns = cache(
  async (storeId: string): Promise<CampaignRow[]> => {
    const [rows, sends] = await Promise.all([
      all<Omit<CampaignRow, "sends" | "sent" | "skipped">>(
        (from, to) =>
          serviceRoleClient()
            .from("campaigns")
            .select(
              "id, name, kind, status, channels, segment, scheduled_at, created_at",
            )
            .eq("store_id", storeId)
            .order("id")
            .range(from, to),
        "Campaigns",
      ),
      all<{ campaign_id: string; status: string }>(
        (from, to) =>
          serviceRoleClient()
            .from("campaign_sends")
            .select("campaign_id, status")
            .eq("store_id", storeId)
            .order("id")
            .range(from, to),
        "Campaign sends",
      ),
    ]);
    return rows.map((c) => {
      const mine = sends.filter((s) => s.campaign_id === c.id);
      return {
        ...c,
        sends: mine.length,
        sent: mine.filter((s) => s.status === "sent").length,
        skipped: mine.filter((s) => s.status === "skipped").length,
      };
    });
  },
);

export type LinkRow = {
  id: string;
  code: string;
  post_id: string | null;
  campaign_id: string | null;
  channel: string | null;
};
export type ClickDayRow = {
  link_id: string;
  day: string;
  country: string | null;
  device: string | null;
  clicks: number;
};

export const loadLinks = cache(async (storeId: string): Promise<LinkRow[]> =>
  all<LinkRow>(
    (from, to) =>
      serviceRoleClient()
        .from("tracked_links")
        .select("id, code, post_id, campaign_id, channel")
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    "Links",
  ),
);

/** Link clicks counted per link, day, country and device (no IP is stored anywhere). */
export const loadClicksByDay = cache(
  async (storeId: string): Promise<ClickDayRow[]> => {
    const rows = await all<{
      link_id: string;
      at: string;
      country: string | null;
      device: string | null;
    }>(
      (from, to) =>
        serviceRoleClient()
          .from("link_clicks")
          .select("link_id, at, country, device")
          .eq("store_id", storeId)
          .order("id")
          .range(from, to),
      "Clicks",
    );
    const out = new Map<string, ClickDayRow>();
    for (const r of rows) {
      const day = r.at.slice(0, 10);
      const key = `${r.link_id}|${day}|${r.country ?? ""}|${r.device ?? ""}`;
      const row = out.get(key) ?? {
        link_id: r.link_id,
        day,
        country: r.country,
        device: r.device,
        clicks: 0,
      };
      row.clicks += 1;
      out.set(key, row);
    }
    return [...out.values()];
  },
);
