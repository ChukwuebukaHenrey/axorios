import "server-only";
import { env } from "@/lib/env";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { COUNTED_STATUSES } from "@/modules/analytics";
import { zapierConnection } from "./adapters/zapier";
import {
  classifyZapierError,
  ConnectionError,
  DEFAULT_ORDERS_PER_EXPORT,
  EXPORT_FIELDS,
  MAX_ORDERS_PER_EXPORT,
  orderRow,
  type ConnectionErrorCode,
  type ExportableOrder,
  type ZapierActionId,
} from "./export-orders";
import type { AppConnection, SheetDestination } from "./types";

const ACTION: ZapierActionId = "export_orders_to_sheets";
/** A 'pending' row older than this is a run that died mid-way, so it may be claimed again. */
const STALE_PENDING_MS = 5 * 60_000;
const ORDER_COLUMNS = "id, created_at, paid_at, status, channel, items, total_minor, currency, charge_total_minor, charge_currency, buyer_country";

export type ExportSelection = { orderIds?: string[]; count?: number };
type ExportOrderSummary = { id: string; date: string; total: string; currency: string; alreadySent: boolean };

export type ExportPreview =
  | { ok: true; app: "Google Sheets"; destination: string; fields: readonly string[]; orders: ExportOrderSummary[]; tasks: number }
  | { ok: false; error: ConnectionErrorCode };

export type ExportOutcome = {
  ok: boolean;
  error?: ConnectionErrorCode;
  destination?: string;
  sent: string[];
  skipped: string[];
  notSent: string[];
};

/** Set by tests only: a fake Zapier. */
let connectionOverride: AppConnection | null = null;
export function __setConnectionForTests(c: AppConnection | null) {
  connectionOverride = c;
}

function destination(): SheetDestination | null {
  const e = env();
  if (e.ZAPIER_ENABLED !== "true" || !e.ZAPIER_SHEET_SPREADSHEET_ID || !e.ZAPIER_SHEET_WORKSHEET_ID) return null;
  return { spreadsheetId: e.ZAPIER_SHEET_SPREADSHEET_ID, worksheetId: e.ZAPIER_SHEET_WORKSHEET_ID, label: e.ZAPIER_SHEET_LABEL || "Google Sheet" };
}

const destinationKey = (d: SheetDestination) => `${d.spreadsheetId}/${d.worksheetId}`;

export function zapierEnabled(): boolean {
  return destination() !== null;
}

/**
 * The Zapier server and sheet belong to the demo account, so only the demo store may write to them:
 * another seller's orders must never land in someone else's sheet. Per-seller Zapier is roadmap.
 */
async function check(storeId: string): Promise<SheetDestination> {
  const d = destination();
  if (!d) throw new ConnectionError("not_enabled");
  const { data, error } = await serviceRoleClient().from("stores").select("slug").eq("id", storeId).single();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  if (data.slug !== env().DEMO_STORE_SLUG) throw new ConnectionError("not_available");
  return d;
}

async function sentOrderIds(storeId: string, d: SheetDestination): Promise<Set<string>> {
  const { data, error } = await serviceRoleClient()
    .from("connection_exports")
    .select("order_id")
    .eq("store_id", storeId)
    .eq("action", ACTION)
    .eq("destination", destinationKey(d))
    .eq("status", "sent");
  if (error) throw new Error(`Export read failed: ${error.code}`);
  return new Set(data.map((r) => r.order_id));
}

/** Orders an approval already ran on. A replayed or retried approval covers exactly these, never the next ones. */
async function ordersOfApproval(storeId: string, d: SheetDestination, approvalId: string): Promise<string[]> {
  const { data, error } = await serviceRoleClient()
    .from("connection_exports")
    .select("order_id")
    .eq("store_id", storeId)
    .eq("action", ACTION)
    .eq("destination", destinationKey(d))
    .eq("approval_id", approvalId);
  if (error) throw new Error(`Export read failed: ${error.code}`);
  return data.map((r) => r.order_id);
}

/** Paid, non-test orders of this store only: named ones, or the latest not yet sent to this sheet. */
async function selectOrders(storeId: string, d: SheetDestination, sel: ExportSelection, approvalId?: string) {
  const sent = await sentOrderIds(storeId, d);
  const db = serviceRoleClient();
  const earlier = approvalId ? await ordersOfApproval(storeId, d, approvalId) : [];
  if (earlier.length > 0) sel = { orderIds: earlier };
  if (sel.orderIds?.length) {
    const ids = [...new Set(sel.orderIds)].slice(0, MAX_ORDERS_PER_EXPORT);
    const { data, error } = await db
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("store_id", storeId)
      .in("id", ids)
      .not("paid_at", "is", null)
      .neq("source", "test")
      .in("status", COUNTED_STATUSES)
      .order("paid_at", { ascending: false });
    if (error) throw new Error(`Order read failed: ${error.code}`);
    return { orders: data as ExportableOrder[], sent };
  }
  const count = Math.min(Math.max(1, sel.count ?? DEFAULT_ORDERS_PER_EXPORT), MAX_ORDERS_PER_EXPORT);
  const { data, error } = await db
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("store_id", storeId)
    .not("paid_at", "is", null)
    .neq("source", "test")
    .in("status", COUNTED_STATUSES)
    .order("paid_at", { ascending: false })
    .limit(count + Math.min(sent.size, 500));
  if (error) throw new Error(`Order read failed: ${error.code}`);
  return { orders: (data as ExportableOrder[]).filter((o) => !sent.has(o.id)).slice(0, count), sent };
}

/** What the approval card shows. Sends nothing. */
export async function previewOrderExport(storeId: string, sel: ExportSelection): Promise<ExportPreview> {
  try {
    const d = await check(storeId);
    const { orders, sent } = await selectOrders(storeId, d, sel);
    const fresh = orders.filter((o) => !sent.has(o.id)).length;
    return {
      ok: true,
      app: "Google Sheets",
      destination: d.label,
      fields: EXPORT_FIELDS,
      orders: orders.map((o) => {
        const row = orderRow(o);
        return { id: row.Order, date: row.Date, total: row.Total, currency: row.Currency, alreadySent: sent.has(o.id) };
      }),
      tasks: fresh * 2,
    };
  } catch (error) {
    if (error instanceof ConnectionError) return { ok: false, error: error.code };
    throw error;
  }
}

/**
 * Claims one (store, order, action, destination) slot. False means it was already sent, or another run holds it.
 * A failed or long-stale pending row is taken over, so a retry after an outage sends what's missing.
 */
async function claim(storeId: string, orderId: string, dest: string, approvalId: string): Promise<boolean> {
  const db = serviceRoleClient();
  const key = { store_id: storeId, order_id: orderId, action: ACTION, destination: dest };
  const inserted = await db
    .from("connection_exports")
    .upsert({ ...key, connection: "zapier", status: "pending", approval_id: approvalId }, { onConflict: "store_id,order_id,action,destination", ignoreDuplicates: true })
    .select("id");
  if (inserted.error) throw new Error(`Export claim failed: ${inserted.error.code}`);
  if (inserted.data.length > 0) return true;
  const staleBefore = new Date(Date.now() - STALE_PENDING_MS).toISOString();
  const retaken = await db
    .from("connection_exports")
    .update({ status: "pending", approval_id: approvalId, error: null, updated_at: new Date().toISOString() })
    .match(key)
    .or(`status.eq.failed,and(status.eq.pending,updated_at.lt.${staleBefore})`)
    .select("id");
  if (retaken.error) throw new Error(`Export claim failed: ${retaken.error.code}`);
  return retaken.data.length > 0;
}

async function finish(storeId: string, orderId: string, dest: string, status: "sent" | "failed", error?: string) {
  await serviceRoleClient()
    .from("connection_exports")
    .update({ status, error: error ?? null, updated_at: new Date().toISOString() })
    .match({ store_id: storeId, order_id: orderId, action: ACTION, destination: dest });
}

/**
 * Runs after the seller pressed Approve. Reads orders, never changes them or any payment.
 * Stops at the first Zapier failure (an outage or quota hits every row the same way) and says which rows didn't go.
 * The caller writes the activity line from the outcome.
 */
export async function runOrderExport(
  storeId: string,
  sel: ExportSelection,
  opts: { approvalId: string },
): Promise<ExportOutcome> {
  const outcome: ExportOutcome = { ok: true, sent: [], skipped: [], notSent: [] };
  let d: SheetDestination;
  try {
    d = await check(storeId);
  } catch (error) {
    if (error instanceof ConnectionError) return { ...outcome, ok: false, error: error.code };
    throw error;
  }
  outcome.destination = d.label;
  const dest = destinationKey(d);
  const { orders, sent } = await selectOrders(storeId, d, sel, opts.approvalId);
  const conn = connectionOverride ?? zapierConnection(env().ZAPIER_MCP_URL!, env().ZAPIER_MCP_TOKEN!);
  try {
    for (const order of orders) {
      const row = orderRow(order);
      if (outcome.error) {
        outcome.notSent.push(row.Order);
        continue;
      }
      if (sent.has(order.id) || !(await claim(storeId, order.id, dest, opts.approvalId))) {
        outcome.skipped.push(row.Order);
        continue;
      }
      try {
        await conn.addSheetRow(d, row);
        await finish(storeId, order.id, dest, "sent");
        outcome.sent.push(row.Order);
      } catch (error) {
        const code = classifyZapierError(error);
        await finish(storeId, order.id, dest, "failed", code);
        outcome.ok = false;
        outcome.error = code;
        outcome.notSent.push(row.Order);
      }
    }
  } finally {
    await conn.close().catch(() => undefined);
  }

  return outcome;
}
