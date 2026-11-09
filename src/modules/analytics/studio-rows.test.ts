import { describe, expect, it } from "vitest";
import type { MoneyOrder } from "./data";
import {
  aov,
  inRange,
  net,
  orderCount,
  periodRange,
  PERIODS,
  refundRate,
  repeatRate,
  sales,
  vatCollected,
} from "./metrics";
import { buildStudioRows, type StudioInput } from "./studio-rows";

const now = new Date("2026-11-09T12:00:00Z");
let n = 0;
function order(p: Partial<MoneyOrder>): MoneyOrder {
  return {
    id: `00000000-0000-4000-8000-${String(n++).padStart(12, "0")}`,
    status: "paid",
    source: "import",
    channel: "web",
    currency: "NGN",
    total_minor: 4_500_000,
    refunded_minor: 0,
    tax_minor: 313_953,
    tax_rate_bp: 750,
    charge_currency: "USD",
    charge_total_minor: 3344,
    fx_rate: 0.000743,
    paypal_fee_minor: 147,
    paypal_net_minor: 3197,
    paypal_capture_id: null,
    paid_at: "2026-11-01T10:00:00Z",
    created_at: "2026-11-01T09:00:00Z",
    contact_id: null,
    link_id: null,
    buyer_country: null,
    fx_source: "frankfurter",
    campaign_id: null,
    refunded_charge_minor: 0,
    fulfilled_at: null,
    ...p,
  };
}

const names: StudioInput["names"] = {
  channel: { web: "Web", telegram: "Telegram" },
  status: {
    paid: "Paid",
    partially_refunded: "Partly refunded",
    refunded: "Refunded",
  },
  match: {
    matched: "Matched",
    mismatch: "Mismatch",
    imported: "Imported, not in PayPal",
    noCapture: "No capture",
    stored: "Stored capture",
    pending: "Waiting",
    outside: "Outside",
    missing: "Missing",
    notOurs: "Not ours",
  },
};

function input(
  orders: MoneyOrder[],
  paypal: StudioInput["paypal"] = [],
): StudioInput {
  return {
    currency: "NGN",
    now,
    orders,
    items: [],
    products: [],
    contacts: [],
    labels: [],
    refunds: [],
    expenses: [],
    posts: [],
    postMetrics: [],
    campaigns: [],
    links: [],
    clicks: [],
    visits: [],
    paypal,
    names,
  };
}

// Spread over 8 months, with refunds, repeat customers and a test order that must never count.
const history: MoneyOrder[] = [];
for (let i = 0; i < 240; i++) {
  const at = new Date(now.getTime() - i * 0.97 * 86_400_000 - 3_600_000);
  history.push(
    order({
      paid_at: at.toISOString(),
      total_minor: 1_000_000 + (i % 7) * 333_333,
      refunded_minor: i % 11 === 0 ? 250_000 : 0,
      status: i % 11 === 0 ? "partially_refunded" : "paid",
      tax_minor: 69_767 + i,
      contact_id: `c${i % 40}`,
      paypal_fee_minor: 100 + (i % 9),
      source: i === 5 ? "test" : "import",
    }),
  );
}

describe("Studio rows", () => {
  const rows = buildStudioRows(input(history));
  const toMinor = (v: number) => Math.round(v * 100);

  for (const period of PERIODS) {
    it(`Sales, Net, VAT, Orders, AOV, refund and repeat rate equal the metrics module for ${period}`, () => {
      const range = periodRange(period, now);
      const inPeriod = rows.orders.filter((o) => {
        const t = Date.parse(o.paidAt);
        return t >= range.from.getTime() && t < range.to.getTime();
      });
      const sum = (
        k: "sales" | "net" | "vat" | "one" | "hasRefund" | "repeat",
      ) => inPeriod.reduce((s, o) => s + o[k], 0);
      const want = inRange(history, range);
      expect(toMinor(sum("sales"))).toBe(sales(want));
      expect(toMinor(sum("net"))).toBe(net(want));
      expect(toMinor(sum("vat"))).toBe(vatCollected(want));
      expect(sum("one")).toBe(orderCount(want));
      expect(toMinor(sum("sales") / sum("one"))).toBe(aov(want));
      expect(sum("hasRefund") / sum("one")).toBeCloseTo(refundRate(want), 12);
      expect(sum("repeat") / sum("one")).toBeCloseTo(
        repeatRate(want, history),
        12,
      );
    });
  }

  it("test orders never load", () => {
    expect(rows.orders).toHaveLength(239);
  });

  it("PayPal match: imported orders aren't mismatches; real captures match by id and amount", () => {
    const real = order({
      source: "app",
      paypal_capture_id: "CAP1",
      paid_at: "2026-11-08T10:00:00Z",
    });
    const wrong = order({
      source: "app",
      paypal_capture_id: "CAP2",
      paid_at: "2026-11-08T10:00:00Z",
    });
    const missing = order({
      source: "app",
      paypal_capture_id: "CAP3",
      paid_at: "2026-11-07T10:00:00Z",
    });
    const fresh = order({
      source: "app",
      paypal_capture_id: "CAP4",
      paid_at: "2026-11-09T11:00:00Z",
    });
    const imported = order({});
    const r = buildStudioRows(
      input(
        [real, wrong, missing, fresh, imported],
        [
          {
            id: "CAP1",
            eventCode: "T0006",
            status: "S",
            at: "2026-11-08T10:00:01Z",
            amountMinor: 3344,
            feeMinor: -147,
            currency: "USD",
          },
          {
            id: "CAP2",
            eventCode: "T0006",
            status: "S",
            at: "2026-11-08T10:00:01Z",
            amountMinor: 3000,
            feeMinor: -140,
            currency: "USD",
          },
          {
            id: "OTHER",
            eventCode: "T0006",
            status: "S",
            at: "2026-11-08T10:00:01Z",
            amountMinor: 999,
            feeMinor: 0,
            currency: "USD",
          },
        ],
      ),
    );
    expect(r.orders.map((o) => o.paypalMatch)).toEqual([
      "Matched",
      "Mismatch",
      "Missing",
      "Waiting",
      "Imported, not in PayPal",
    ]);
    expect(r.paypal.map((t) => t.match)).toEqual([
      "Matched",
      "Mismatch",
      "Not ours",
    ]);
    const fallback = buildStudioRows(input([real, imported], null));
    expect(fallback.orders.map((o) => o.paypalMatch)).toEqual([
      "Stored capture",
      "Imported, not in PayPal",
    ]);
    expect(fallback.paypalLive).toBe(false);
  });
});
