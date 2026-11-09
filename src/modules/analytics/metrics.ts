/**
 * The one definition of every number shown in more than one place (spec v2, "Shared metric definitions").
 * Home, Store, Marketing, Money and Analytics all import from here. Pure: no I/O.
 * All amounts are integer minor units of the STORE currency unless a name says otherwise.
 */
import { currencyDecimals } from "../../lib/money";

export type MetricOrder = {
  id: string;
  status: string;
  source: string;
  channel: string;
  currency: string; // store currency
  total_minor: number;
  refunded_minor: number;
  tax_minor: number;
  charge_currency: string;
  charge_total_minor: number;
  fx_rate: number | null; // charge units per store unit, locked at sale
  paypal_fee_minor: number | null; // charge currency
  paid_at: string | null;
  contact_id: string | null;
  link_id: string | null;
};

export const COUNTED_STATUSES = ["paid", "refunded", "partially_refunded"] as const;

/** Orders that count as sales: paid at some point, and not a test order. */
export function isCounted(o: Pick<MetricOrder, "status" | "source" | "paid_at">): boolean {
  return o.paid_at !== null && o.source !== "test" && (COUNTED_STATUSES as readonly string[]).includes(o.status);
}

// ─── periods ───

export const PERIODS = ["7d", "30d", "3m", "6m"] as const;
export type Period = (typeof PERIODS)[number];

export type Range = { from: Date; to: Date };

/** [from, to) ending now. Months are calendar months, so 6m from 9 Nov starts 9 May. */
export function periodRange(period: Period, now = new Date()): Range {
  const from = new Date(now);
  if (period === "7d") from.setUTCDate(from.getUTCDate() - 7);
  else if (period === "30d") from.setUTCDate(from.getUTCDate() - 30);
  else from.setUTCMonth(from.getUTCMonth() - (period === "3m" ? 3 : 6));
  return { from, to: now };
}

/** The same length of time immediately before `range`, for "change vs previous period". */
export function previousRange({ from, to }: Range): Range {
  const ms = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - ms), to: from };
}

export function inRange<T extends { paid_at: string | null }>(orders: T[], { from, to }: Range): T[] {
  const a = from.getTime();
  const b = to.getTime();
  return orders.filter((o) => {
    if (!o.paid_at) return false;
    const t = Date.parse(o.paid_at);
    return t >= a && t < b;
  });
}

// ─── money ───

/** Paid orders minus refunds, store currency, at the rate recorded at sale. Labelled "Sales". */
export function sales(orders: MetricOrder[]): number {
  return orders.filter(isCounted).reduce((sum, o) => sum + o.total_minor - o.refunded_minor, 0);
}

/** A charge-currency amount in store minor units, using the order's own locked rate. */
export function chargeToStore(o: Pick<MetricOrder, "currency" | "charge_currency" | "fx_rate">, chargeMinor: number): number {
  if (o.charge_currency === o.currency || !o.fx_rate) return chargeMinor;
  const shift = 10 ** (currencyDecimals(o.currency) - currencyDecimals(o.charge_currency));
  return Math.round((chargeMinor / o.fx_rate) * shift);
}

/** PayPal fees in store currency. */
export function fees(orders: MetricOrder[]): number {
  return orders.filter(isCounted).reduce((sum, o) => sum + chargeToStore(o, o.paypal_fee_minor ?? 0), 0);
}

/** Sales minus PayPal fees. */
export function net(orders: MetricOrder[]): number {
  return sales(orders) - fees(orders);
}

export function orderCount(orders: MetricOrder[]): number {
  return orders.filter(isCounted).length;
}

/** Average order value: Sales / Orders, rounded to the minor unit. 0 with no orders. */
export function aov(orders: MetricOrder[]): number {
  const n = orderCount(orders);
  return n === 0 ? 0 : Math.round(sales(orders) / n);
}

/** VAT kept: each order's VAT scaled by the share not refunded. */
export function vatCollected(orders: MetricOrder[]): number {
  return orders
    .filter(isCounted)
    .reduce((sum, o) => sum + (o.total_minor === 0 ? 0 : Math.round((o.tax_minor * (o.total_minor - o.refunded_minor)) / o.total_minor)), 0);
}

// ─── rates (0..1) ───

/** Orders / visits. */
export function conversion(orders: MetricOrder[], visits: number): number {
  return visits === 0 ? 0 : orderCount(orders) / visits;
}

/** Share of counted orders with any refund. */
export function refundRate(orders: MetricOrder[]): number {
  const counted = orders.filter(isCounted);
  return counted.length === 0 ? 0 : counted.filter((o) => o.refunded_minor > 0).length / counted.length;
}

/**
 * Share of the period's orders placed by a returning customer: one whose first counted order
 * (in all history) is earlier than this order. Orders without a contact count as new.
 */
export function repeatRate(periodOrders: MetricOrder[], allOrders: MetricOrder[]): number {
  const first = new Map<string, number>();
  for (const o of allOrders.filter(isCounted)) {
    if (!o.contact_id || !o.paid_at) continue;
    const t = Date.parse(o.paid_at);
    const seen = first.get(o.contact_id);
    if (seen === undefined || t < seen) first.set(o.contact_id, t);
  }
  const counted = periodOrders.filter(isCounted);
  if (counted.length === 0) return 0;
  const repeat = counted.filter((o) => o.contact_id && Date.parse(o.paid_at!) > (first.get(o.contact_id) ?? Infinity));
  return repeat.length / counted.length;
}

/** Orders that came through one tracked link (a post's or campaign's). */
export function postConversions(orders: MetricOrder[], linkId: string): number {
  return orders.filter((o) => isCounted(o) && o.link_id === linkId).length;
}

/** Change vs previous period as a ratio (0.12 = +12%). null when there's nothing to compare against. */
export function change(current: number, previous: number): number | null {
  return previous === 0 ? null : (current - previous) / previous;
}

/** Daily Sales for sparklines and charts: one entry per UTC day in the range, zeros included. */
export function dailySales(orders: MetricOrder[], { from, to }: Range): { day: string; sales: number; orders: number }[] {
  const days = new Map<string, { sales: number; orders: number }>();
  for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); t < to.getTime(); t += 86_400_000) {
    days.set(new Date(t).toISOString().slice(0, 10), { sales: 0, orders: 0 });
  }
  for (const o of inRange(orders.filter(isCounted), { from, to })) {
    const d = days.get(o.paid_at!.slice(0, 10));
    if (!d) continue;
    d.sales += o.total_minor - o.refunded_minor;
    d.orders += 1;
  }
  return [...days].map(([day, v]) => ({ day, ...v }));
}

/** The headline block every page shows for a period. */
export function summary(orders: MetricOrder[], range: Range, visits = 0) {
  const current = inRange(orders, range);
  const previous = inRange(orders, previousRange(range));
  return {
    sales: sales(current),
    salesChange: change(sales(current), sales(previous)),
    net: net(current),
    fees: fees(current),
    orders: orderCount(current),
    aov: aov(current),
    vat: vatCollected(current),
    refundRate: refundRate(current),
    repeatRate: repeatRate(current, orders),
    conversion: conversion(current, visits),
  };
}
