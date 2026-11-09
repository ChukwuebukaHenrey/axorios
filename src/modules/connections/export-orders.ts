/**
 * "Export orders to Google Sheets" (spec v2, "Zapier connection"). Pure: no server imports,
 * so the approval card, the service and tests share the field list and the error wording.
 */
import { minorToDecimal } from "@/lib/money";

/** The one allowlisted connection action. A new action is a new entry here plus its own card. */
export const ZAPIER_ACTIONS = ["export_orders_to_sheets"] as const;
export type ZapierActionId = (typeof ZAPIER_ACTIONS)[number];

/** Zapier counts 2 tasks per call and the free plan has 100 a month, so one approval sends at most this many rows. */
export const MAX_ORDERS_PER_EXPORT = 10;
export const DEFAULT_ORDERS_PER_EXPORT = 2;

/**
 * Column headers, in sheet order. These are exactly the fields sent; no email, phone or address.
 * The sheet's first row must hold these headers.
 */
export const EXPORT_FIELDS = ["Order", "Date", "Status", "Channel", "Items", "Total", "Currency", "Charged", "Charged currency", "Country"] as const;
export type ExportField = (typeof EXPORT_FIELDS)[number];
export type ExportRow = Record<ExportField, string>;

type Line = { name: string; quantity: number };
export type ExportableOrder = {
  id: string;
  created_at: string;
  paid_at: string | null;
  status: string;
  channel: string;
  items: unknown;
  total_minor: number;
  currency: string;
  charge_total_minor: number;
  charge_currency: string;
  buyer_country: string | null;
};

/** Amounts as plain decimals with no symbol or grouping, so the sheet can sum them. */
export function orderRow(order: ExportableOrder): ExportRow {
  const lines = Array.isArray(order.items) ? (order.items as Line[]) : [];
  return {
    Order: order.id.slice(0, 8),
    Date: (order.paid_at ?? order.created_at).slice(0, 10),
    Status: order.status,
    Channel: order.channel,
    Items: lines.map((l) => `${l.quantity} x ${l.name}`).join(", "),
    Total: minorToDecimal(order.total_minor, order.currency),
    Currency: order.currency,
    Charged: minorToDecimal(order.charge_total_minor, order.charge_currency),
    "Charged currency": order.charge_currency,
    Country: order.buyer_country ?? "",
  };
}

export type ConnectionErrorCode =
  | "not_enabled"
  | "not_available"
  | "zapier_quota"
  | "zapier_auth"
  | "zapier_unavailable"
  | "sheet_columns_missing"
  | "zapier_failed";

export class ConnectionError extends Error {
  constructor(
    readonly code: ConnectionErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/**
 * Turns whatever Zapier or the network threw into one of our codes. Quota and outage are told apart,
 * because the seller's next step differs: wait for the quota, or try again later.
 */
export function classifyZapierError(error: unknown): ConnectionErrorCode {
  if (error instanceof ConnectionError) return error.code;
  const text = (error instanceof Error ? `${error.name} ${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error)).toLowerCase();
  const status = Number((error as { statusCode?: unknown; status?: unknown })?.statusCode ?? (error as { status?: unknown })?.status);
  if (status === 429 || /quota|task limit|rate limit|too many requests|usage limit|\b429\b/.test(text)) return "zapier_quota";
  if (status === 401 || status === 403 || /unauthori[sz]ed|forbidden|\b401\b|\b403\b|invalid token|reconnect|authenticat/.test(text)) return "zapier_auth";
  if (
    (status >= 500 && status < 600) ||
    /fetch failed|econn|enotfound|etimedout|timeout|timed out|network|socket|\b50[0-9]\b|unavailable|bad gateway/.test(text)
  ) {
    return "zapier_unavailable";
  }
  return "zapier_failed";
}
