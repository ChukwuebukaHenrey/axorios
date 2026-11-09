import { describe, expect, it } from "vitest";
import { net, sales, summary, vatCollected, type MetricOrder } from "./metrics";
import { monthStatement, statementCsv, averageQuoteRate, dailyMoneyIn, expensesIn, fxDifference, monthRange, moneyIn, moneyOverview, statementMonths, toCsv, vatByMonth } from "./money";

let n = 0;
function order(p: Partial<MetricOrder>): MetricOrder {
  return {
    id: `o${n++}`,
    status: "paid",
    source: "import",
    channel: "web",
    currency: "NGN",
    total_minor: 4_500_000, // ₦45,000 → $33.44 at 0.000743
    refunded_minor: 0,
    tax_minor: 313_953,
    charge_currency: "USD",
    charge_total_minor: 3344,
    fx_rate: 0.000743,
    paypal_fee_minor: 147,
    paid_at: "2026-11-01T10:00:00Z",
    contact_id: null,
    link_id: null,
    ...p,
  };
}

const range = { from: new Date("2026-10-10T00:00:00Z"), to: new Date("2026-11-09T12:00:00Z") };

describe("money", () => {
  const orders = [
    order({}),
    order({ channel: "telegram", status: "partially_refunded", refunded_minor: 1_500_000 }),
    order({ paid_at: "2026-10-01T09:00:00Z" }), // before the range
    order({ source: "test" }),
  ];
  const expenses = [
    { day: "2026-11-02", amount_minor: 2_000_000, category: "Flour" },
    { day: "2026-11-09", amount_minor: 500_000, category: "Gas" }, // today counts
    { day: "2026-10-09", amount_minor: 9_999_999, category: "Flour" }, // day before the range
  ];
  const withdrawals = [{ day: "2026-11-05", usd_minor: 5000, ngn_minor: 6_600_000, rate: 1320 }];

  it("Money in's Sales and Net are the metrics module's", () => {
    const inn = moneyIn(orders, range);
    const s = summary(orders, range);
    expect(inn.sales).toBe(s.sales);
    expect(inn.net).toBe(s.net);
    expect(inn.gross - inn.refunds).toBe(inn.sales);
    expect(inn.orders).toBe(2);
    expect(inn.byChannel.map((c) => c.channel)).toEqual(["web", "telegram"]);
  });

  it("daily rows add up to Money in", () => {
    const days = dailyMoneyIn(orders, range);
    const inn = moneyIn(orders, range);
    expect(days.reduce((x, d) => x + d.gross, 0)).toBe(inn.sales);
    expect(days.reduce((x, d) => x + d.net, 0)).toBe(inn.net);
  });

  it("expenses count whole days in the range", () => {
    const e = expensesIn(expenses, range);
    expect(e.total).toBe(2_500_000);
    expect(e.byCategory[0]).toEqual({ category: "Flour", amount: 2_000_000 });
  });

  it("FX difference compares Paga's rate with the quote buyers saw", () => {
    const quote = averageQuoteRate(orders)!;
    expect(quote).toBeCloseTo(4_500_000 / 3344, 6); // ≈ ₦1,345.69 per $
    const fx = fxDifference(withdrawals, orders, range);
    expect(fx.atQuote).toBe(Math.round(5000 * quote));
    expect(fx.difference).toBe(6_600_000 - fx.atQuote);
    expect(fx.difference).toBeLessThan(0); // Paga paid less than the quote: a loss
  });

  it("a store charging its own currency has no FX difference", () => {
    const gbp = [order({ currency: "GBP", charge_currency: "GBP", total_minor: 3000, charge_total_minor: 3000, fx_rate: null, tax_minor: 0 })];
    expect(averageQuoteRate(gbp)).toBeNull();
    expect(fxDifference([], gbp, range).difference).toBe(0);
  });

  it("what's left = Net − expenses − FX loss − plan fees", () => {
    const o = moneyOverview(orders, expenses, withdrawals, range);
    expect(o.left).toBe(net(orders.slice(0, 2)) - 2_500_000 + o.fx.difference);
    expect(o.moneyOut.total).toBe(o.moneyIn.gross - o.left);
  });

  it("VAT owed per month equals the VAT the metrics module keeps", () => {
    const months = vatByMonth(orders);
    expect(months.map((m) => m.month)).toEqual(["2026-11", "2026-10"]);
    const nov = months[0];
    expect(nov.owed).toBe(vatCollected(orders.slice(0, 2)));
    expect(nov.charged - nov.credits).toBe(nov.owed);
    expect(nov.creditNotes).toBe(1);
    expect(nov.sales).toBe(sales(orders.slice(0, 2)));
  });

  it("statements cover calendar months", () => {
    expect(statementMonths(orders)).toEqual(["2026-11", "2026-10"]);
    expect(monthRange("2026-12")).toEqual({ from: new Date("2026-12-01T00:00:00Z"), to: new Date("2027-01-01T00:00:00Z") });
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("../x")).toBeNull();
  });

  it("CSV quotes text and defuses formulas", () => {
    expect(toCsv([["a,b", 'say "hi"', -5, null], ["=SUM(A1)", "@x", "ok"]])).toBe('"a,b","say ""hi""",-5,\r\n\'=SUM(A1),\'@x,ok');
  });

  it("a month's statement totals are Money's numbers for that month", () => {
    const s = monthStatement("2026-11", { orders, refunds: [], expenses: expenses.map((e) => ({ ...e, currency: "NGN", note: null })), withdrawals: withdrawals.map((w) => ({ ...w, reference: "PAGA-1" })) })!;
    expect(s.orders).toHaveLength(2);
    expect(s.totals.sales).toBe(sales(orders.slice(0, 2)));
    expect(s.expenses).toHaveLength(2);
    const csv = statementCsv(s, "NGN");
    expect(csv.split("\r\n")[0]).toContain("Amount (NGN)");
    expect(csv).toContain(`Total,,,Sales (paid orders minus refunds),${(s.totals.sales / 100).toFixed(2)}`);
    expect(monthStatement("nope", { orders, refunds: [], expenses: [], withdrawals: [] })).toBeNull();
  });
});
