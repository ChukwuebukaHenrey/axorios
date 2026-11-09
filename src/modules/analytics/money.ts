/**
 * Money tab arithmetic (spec v2, Money). Pure: the page loads rows, these add them up.
 * Built on metrics.ts so Money's Sales, Net and VAT are the same numbers Home and Analytics show.
 * Store-currency minor units unless a name says otherwise.
 */
import { currencyDecimals } from "../../lib/money";
import { chargeToStore, fees, inRange, isCounted, net, orderCount, sales, vatCollected, type MetricOrder, type Range } from "./metrics";

type Dated = { day: string };
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
export function daysInRange<T extends Dated>(rows: T[], { from, to }: Range): T[] {
  // A day counts when it starts inside the range, so a range ending now includes today.
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return rows.filter((r) => dayMs(r.day) >= a && dayMs(r.day) < to.getTime());
}

// ─── money in ───

export function moneyIn(orders: MetricOrder[], range: Range) {
  const current = inRange(orders, range).filter(isCounted);
  const byChannel = new Map<string, { sales: number; orders: number }>();
  for (const o of current) {
    const c = byChannel.get(o.channel) ?? { sales: 0, orders: 0 };
    c.sales += o.total_minor - o.refunded_minor;
    c.orders += 1;
    byChannel.set(o.channel, c);
  }
  return {
    gross: current.reduce((s, o) => s + o.total_minor, 0),
    refunds: current.reduce((s, o) => s + o.refunded_minor, 0),
    sales: sales(current),
    fees: fees(current),
    net: net(current),
    vat: vatCollected(current),
    orders: orderCount(current),
    byChannel: [...byChannel].map(([channel, v]) => ({ channel, ...v })).sort((x, y) => y.sales - x.sales),
  };
}

/** Gross, fee and net per UTC day, zeros included. Fees at each order's own rate. */
export function dailyMoneyIn(orders: MetricOrder[], { from, to }: Range) {
  const days = new Map<string, { gross: number; fees: number; net: number; orders: number }>();
  for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); t < to.getTime(); t += 86_400_000) {
    days.set(new Date(t).toISOString().slice(0, 10), { gross: 0, fees: 0, net: 0, orders: 0 });
  }
  for (const o of inRange(orders, { from, to }).filter(isCounted)) {
    const d = days.get(o.paid_at!.slice(0, 10));
    if (!d) continue;
    const fee = chargeToStore(o, o.paypal_fee_minor ?? 0);
    d.gross += o.total_minor - o.refunded_minor;
    d.fees += fee;
    d.net += o.total_minor - o.refunded_minor - fee;
    d.orders += 1;
  }
  return [...days].map(([day, v]) => ({ day, ...v }));
}

// ─── expenses ───

export type Expense = { day: string; amount_minor: number; category: string };

export function expensesIn<T extends Expense>(expenses: T[], range: Range) {
  const rows = daysInRange(expenses, range);
  const byCategory = new Map<string, number>();
  for (const e of rows) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount_minor);
  return {
    rows: [...rows].sort((a, b) => (a.day < b.day ? 1 : -1)),
    total: rows.reduce((s, e) => s + e.amount_minor, 0),
    byCategory: [...byCategory].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  };
}

// ─── FX ───

export type Withdrawal = { day: string; usd_minor: number; ngn_minor: number; rate: number };

/**
 * The quote rate buyers were shown, averaged over the orders charged in another currency (weighted by value):
 * store units per charge unit. null when every order was charged in the store's own currency.
 */
export function averageQuoteRate(orders: MetricOrder[]): number | null {
  const crossed = orders.filter((o) => isCounted(o) && o.charge_currency !== o.currency && o.fx_rate);
  if (crossed.length === 0) return null;
  const o = crossed[0];
  const shift = 10 ** (currencyDecimals(o.currency) - currencyDecimals(o.charge_currency));
  const store = crossed.reduce((s, x) => s + x.total_minor, 0);
  const charge = crossed.reduce((s, x) => s + x.charge_total_minor, 0);
  return charge === 0 ? null : store / (charge * shift);
}

/**
 * Gain or loss between the quote shown to buyers and the rate Paga paid on withdrawal.
 * `difference` > 0 is a gain. Store minor units.
 */
export function fxDifference<T extends Withdrawal>(withdrawals: T[], orders: MetricOrder[], range: Range) {
  const rows = daysInRange(withdrawals, range);
  const quote = averageQuoteRate(inRange(orders, range)) ?? averageQuoteRate(orders);
  const received = rows.reduce((s, w) => s + w.ngn_minor, 0);
  const atQuote = quote === null ? received : Math.round(rows.reduce((s, w) => s + w.usd_minor * quote, 0));
  return {
    rows: [...rows].sort((a, b) => (a.day < b.day ? 1 : -1)),
    withdrawnUsd: rows.reduce((s, w) => s + w.usd_minor, 0),
    received,
    atQuote,
    quoteRate: quote,
    difference: received - atQuote,
  };
}

// ─── overview ───

/** AxoriOS charges nothing during the hackathon beta. Kept as a line so the shape is right when plans exist. */
export const PLAN_FEES_MINOR = 0;

export function moneyOverview<E extends Expense, W extends Withdrawal>(orders: MetricOrder[], expenses: E[], withdrawals: W[], range: Range) {
  const inn = moneyIn(orders, range);
  const exp = expensesIn(expenses, range);
  const fx = fxDifference(withdrawals, orders, range);
  const out = {
    fees: inn.fees,
    refunds: inn.refunds,
    expenses: exp.total,
    fxLoss: -fx.difference, // negative when the rate went our way
    plan: PLAN_FEES_MINOR,
  };
  const outTotal = out.fees + out.refunds + out.expenses + out.fxLoss + out.plan;
  return { moneyIn: inn, moneyOut: { ...out, total: outTotal }, left: inn.gross - outTotal, expenses: exp, fx };
}

// ─── VAT ───

const month = (iso: string) => iso.slice(0, 7);

/** Per calendar month of sale: VAT charged, VAT reversed by refunds (credit notes), VAT owed (= metrics' VAT kept). */
export function vatByMonth(orders: MetricOrder[]) {
  const months = new Map<string, MetricOrder[]>();
  for (const o of orders.filter(isCounted)) {
    const m = month(o.paid_at!);
    months.set(m, [...(months.get(m) ?? []), o]);
  }
  return [...months]
    .map(([m, list]) => {
      const charged = list.reduce((s, o) => s + o.tax_minor, 0);
      const owed = vatCollected(list);
      return { month: m, sales: sales(list), charged, credits: charged - owed, owed, creditNotes: list.filter((o) => o.refunded_minor > 0 && o.tax_minor > 0).length };
    })
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}

/** The calendar months [from, to) of a "YYYY-MM" key, for statements. */
export function monthRange(key: string): Range | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return null;
  return { from: new Date(Date.UTC(y, mo, 1)), to: new Date(Date.UTC(y, mo + 1, 1)) };
}

/** Months with any paid order, newest first. */
export function statementMonths(orders: MetricOrder[]): string[] {
  return [...new Set(orders.filter(isCounted).map((o) => month(o.paid_at!)))].sort().reverse();
}

/**
 * RFC 4180 CSV. Numbers stay as written; text with commas, quotes or newlines is quoted, and text a spreadsheet
 * would run as a formula (=, +, -, @ first) gets a leading apostrophe, since notes can come from customers.
 */
export function toCsv(rows: (string | number | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v === null ? "" : typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
          return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

// ─── statements ───

type StatementOrder = MetricOrder & { paypal_capture_id?: string | null };
type StatementRefund = { order_id: string; created_at: string; amount_minor: number; currency: string; store_amount_minor: number; vat_reversed_minor: number; status: string };
type StatementExpense = Expense & { currency: string; note: string | null };
type StatementWithdrawal = Withdrawal & { reference: string | null };

/** One month for the accountant: every counted order, refund, expense and withdrawal, with totals that match Money. */
export function monthStatement(key: string, data: { orders: StatementOrder[]; refunds: StatementRefund[]; expenses: StatementExpense[]; withdrawals: StatementWithdrawal[] }) {
  const range = monthRange(key);
  if (!range) return null;
  const orders = inRange(data.orders, range)
    .filter(isCounted)
    .sort((a, b) => (a.paid_at! < b.paid_at! ? -1 : 1));
  const refunds = data.refunds.filter((r) => Date.parse(r.created_at) >= range.from.getTime() && Date.parse(r.created_at) < range.to.getTime() && r.status !== "failed");
  const overview = moneyOverview(data.orders, data.expenses, data.withdrawals, range);
  return {
    range,
    orders: orders.map((o) => ({
      id: o.id,
      paidAt: o.paid_at!,
      channel: o.channel,
      total: o.total_minor,
      refunded: o.refunded_minor,
      vat: o.tax_minor,
      chargeCurrency: o.charge_currency,
      charged: o.charge_total_minor,
      fxRate: o.fx_rate,
      fee: chargeToStore(o, o.paypal_fee_minor ?? 0),
      captureId: o.paypal_capture_id ?? null,
    })),
    refunds,
    expenses: daysInRange(data.expenses, range).sort((a, b) => (a.day < b.day ? -1 : 1)),
    withdrawals: daysInRange(data.withdrawals, range).sort((a, b) => (a.day < b.day ? -1 : 1)),
    totals: { ...overview.moneyIn, out: overview.moneyOut, left: overview.left, vatOwed: overview.moneyIn.vat },
  };
}

export function statementCsv(s: NonNullable<ReturnType<typeof monthStatement>>, currency: string): string {
  const d = currencyDecimals(currency);
  const amt = (minor: number) => (minor / 10 ** d).toFixed(d);
  const rows: (string | number | null)[][] = [
    ["Section", "Date", "Reference", "Description", `Amount (${currency})`, `VAT (${currency})`, `PayPal fee (${currency})`, "Charged", "Charge currency", "FX rate", "PayPal capture ID"],
  ];
  for (const o of s.orders) {
    rows.push(["Sale", o.paidAt.slice(0, 10), o.id, o.channel, amt(o.total), amt(o.vat), amt(o.fee), (o.charged / 10 ** currencyDecimals(o.chargeCurrency)).toFixed(currencyDecimals(o.chargeCurrency)), o.chargeCurrency, o.fxRate, o.captureId]);
  }
  for (const r of s.refunds) rows.push(["Refund", r.created_at.slice(0, 10), r.order_id, `Refund ${r.status}`, amt(-r.store_amount_minor), amt(-r.vat_reversed_minor), null, (-r.amount_minor / 10 ** currencyDecimals(r.currency)).toFixed(currencyDecimals(r.currency)), r.currency, null, null]);
  for (const e of s.expenses) rows.push(["Expense", e.day, null, `${e.category}${e.note ? `: ${e.note}` : ""}`, amt(-e.amount_minor), null, null, null, null, null, null]);
  for (const w of s.withdrawals) rows.push(["Withdrawal (Paga)", w.day, w.reference, "PayPal to Paga", amt(w.ngn_minor), null, null, (w.usd_minor / 100).toFixed(2), "USD", w.rate, null]);
  rows.push([]);
  rows.push(["Total", null, null, "Sales (paid orders minus refunds)", amt(s.totals.sales)]);
  rows.push(["Total", null, null, "PayPal fees", amt(s.totals.fees)]);
  rows.push(["Total", null, null, "Net", amt(s.totals.net)]);
  rows.push(["Total", null, null, "VAT owed", amt(s.totals.vatOwed)]);
  rows.push(["Total", null, null, "Expenses", amt(s.totals.out.expenses)]);
  rows.push(["Total", null, null, "What's left (estimated from logged expenses)", amt(s.totals.left)]);
  return toCsv(rows);
}
