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
};

const ORDER_COLUMNS =
  "id, status, source, channel, currency, total_minor, refunded_minor, tax_minor, tax_rate_bp, charge_currency, charge_total_minor, fx_rate, paypal_fee_minor, paypal_net_minor, paypal_capture_id, paid_at, contact_id, link_id, created_at, buyer_country";

const PAGE = 1000;

/** Every row of a store-scoped query, a page at a time. PostgREST paging needs a stable order (by id). */
async function all<T>(run: (from: number, to: number) => PromiseLike<{ data: unknown; error: { code: string } | null }>, what: string): Promise<T[]> {
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
export const loadMetricOrders = cache(async (storeId: string): Promise<MoneyOrder[]> =>
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
export const loadRefunds = cache(async (storeId: string): Promise<RefundRow[]> => {
  const [rows, orders] = await Promise.all([
    all<RefundRow>(
      (from, to) =>
        serviceRoleClient()
          .from("refunds")
          .select("id, order_id, amount_minor, currency, store_amount_minor, vat_reversed_minor, fee_returned_minor, status, reason, requested_by, created_at")
          .eq("store_id", storeId)
          .order("id")
          .range(from, to),
      "Refunds",
    ),
    loadMetricOrders(storeId),
  ]);
  const known = new Set(orders.map((o) => o.id));
  return rows.filter((r) => known.has(r.order_id));
});

export type ExpenseRow = { id: string; day: string; amount_minor: number; currency: string; category: string; note: string | null; source: string };

export const loadExpenses = cache(async (storeId: string): Promise<ExpenseRow[]> =>
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

export type WithdrawalRow = { id: string; day: string; usd_minor: number; ngn_minor: number; rate: number; provider: string; reference: string | null; source: string };

export const loadWithdrawals = cache(async (storeId: string): Promise<WithdrawalRow[]> =>
  all<WithdrawalRow>(
    (from, to) =>
      serviceRoleClient()
        .from("withdrawals")
        .select("id, day, usd_minor, ngn_minor, rate, provider, reference, source")
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    "Withdrawals",
  ),
);

/** Store visits summed over [from, to) by day. */
export const loadVisits = cache(async (storeId: string): Promise<{ day: string; visits: number }[]> => {
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
  return [...byDay].map(([day, visits]) => ({ day, visits })).sort((a, b) => (a.day < b.day ? -1 : 1));
});

/**
 * Saves an expense the seller approved in Axori AI (spec v2, Money › Expenses). Store currency, from the store row.
 * Only called from an approval-gated tool.
 */
export async function logExpense(storeId: string, input: { amount: string; category: string; note?: string; day?: string; approvalId: string }) {
  const db = serviceRoleClient();
  const { data: store, error } = await db.from("stores").select("currency, owner_id").eq("id", storeId).single();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  const day = input.day ?? new Date().toISOString().slice(0, 10);
  const { data: row, error: insertError } = await db
    .from("expenses")
    .insert({ store_id: storeId, day, amount_minor: parseToMinor(input.amount, store.currency), currency: store.currency, category: input.category, note: input.note ?? null, source: "chat" })
    .select("id, day, amount_minor, currency, category")
    .single();
  if (insertError) throw new Error(`Expense save failed: ${insertError.code}`);
  await db.from("activity_log").insert({ owner_id: store.owner_id, store_id: storeId, actor: "axori_ai", action: "log_expense", target: row.id, approval_id: input.approvalId, details: row });
  return row;
}
