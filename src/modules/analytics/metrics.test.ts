import { describe, expect, it } from "vitest";
import { vatFor } from "../orders/schema";
import {
  aov,
  chargeToStore,
  fees,
  inRange,
  isCounted,
  lineSales,
  lowStockCount,
  net,
  periodRange,
  previousRange,
  productRanking,
  repeatRate,
  sales,
  summary,
  vatCollected,
  type MetricOrder,
} from "./metrics";

let n = 0;
function order(p: Partial<MetricOrder>): MetricOrder {
  return {
    id: `o${n++}`,
    status: "paid",
    source: "import",
    channel: "web",
    currency: "NGN",
    total_minor: 4_500_000, // ₦45,000
    refunded_minor: 0,
    tax_minor: 313_953,
    charge_currency: "USD",
    charge_total_minor: 3344,
    fx_rate: 0.000743, // USD per NGN
    paypal_fee_minor: 147, // $1.47
    paid_at: "2026-11-01T10:00:00Z",
    contact_id: null,
    link_id: null,
    ...p,
  };
}

describe("metrics", () => {
  it("Sales is paid orders minus refunds, skipping test, pending and unpaid", () => {
    const os = [
      order({}),
      order({ status: "partially_refunded", refunded_minor: 1_000_000 }),
      order({ source: "test" }),
      order({ status: "pending", paid_at: null }),
    ];
    expect(sales(os)).toBe(4_500_000 + 3_500_000);
    expect(os.filter(isCounted)).toHaveLength(2);
  });

  it("fees convert from the charge currency at the order's own rate", () => {
    // $1.47 / 0.000743 USD per NGN = ₦1,978.47 → 197,847 kobo
    expect(chargeToStore(order({}), 147)).toBe(197_847);
    expect(fees([order({})])).toBe(197_847);
    expect(net([order({})])).toBe(4_500_000 - 197_847);
    // same currency: no conversion
    expect(
      chargeToStore(
        order({ currency: "GBP", charge_currency: "GBP", fx_rate: null }),
        150,
      ),
    ).toBe(150);
  });

  it("AOV rounds to the minor unit and is 0 with no orders", () => {
    expect(aov([])).toBe(0);
    expect(
      aov([order({ total_minor: 100 }), order({ total_minor: 101 })]),
    ).toBe(101);
  });

  it("VAT kept shrinks with refunds", () => {
    expect(
      vatCollected([
        order({
          total_minor: 1000,
          tax_minor: 70,
          refunded_minor: 500,
          status: "partially_refunded",
        }),
      ]),
    ).toBe(35);
  });

  it("repeat rate counts orders from customers who bought before", () => {
    const all = [
      order({ contact_id: "a", paid_at: "2026-09-01T00:00:00Z" }),
      order({ contact_id: "a", paid_at: "2026-11-02T00:00:00Z" }),
      order({ contact_id: "b", paid_at: "2026-11-03T00:00:00Z" }),
    ];
    expect(repeatRate(all.slice(1), all)).toBe(0.5);
  });

  it("periods: 6m from 9 Nov starts 9 May; previous period is the same length before it", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    const r = periodRange("6m", now);
    expect(r.from.toISOString().slice(0, 10)).toBe("2026-05-09");
    const p = previousRange(periodRange("7d", now));
    expect(p.to.toISOString()).toBe("2026-11-02T12:00:00.000Z");
  });

  it("Home's Sales equals Money's Sales for every period (one definition)", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    const os = Array.from({ length: 200 }, (_, i) =>
      order({
        paid_at: new Date(now.getTime() - i * 86_400_000).toISOString(),
        refunded_minor: i % 25 === 0 ? 500_000 : 0,
      }),
    );
    for (const p of ["7d", "30d", "3m", "6m"] as const) {
      const home = summary(os, periodRange(p, now)).sales;
      const money = sales(
        os.filter(
          (o) =>
            Date.parse(o.paid_at!) >= periodRange(p, now).from.getTime() &&
            Date.parse(o.paid_at!) < now.getTime(),
        ),
      );
      expect(home).toBe(money);
    }
  });
});

describe("VAT", () => {
  const registered = {
    vatRegistered: true,
    vatRateBp: 750,
    pricesIncludeTax: true,
  };
  it("inclusive 7.5%: ₦45,000 carries ₦3,139.53", () => {
    expect(vatFor(4_500_000, registered)).toEqual({
      taxMinor: 313_953,
      rateBp: 750,
      inclusive: true,
      grossMinor: 4_500_000,
    });
  });
  it("exclusive adds on top", () => {
    expect(
      vatFor(10_000, { ...registered, pricesIncludeTax: false }),
    ).toMatchObject({ taxMinor: 750, grossMinor: 10_750 });
  });
  it("not registered is 0", () => {
    expect(
      vatFor(10_000, { ...registered, vatRegistered: false }).taxMinor,
    ).toBe(0);
  });
});

describe("catalogue metrics", () => {
  it("low stock counts only active tracked products at or under the threshold", () => {
    const p = (
      q: Partial<{
        inventory_mode: string;
        stock: number;
        low_stock_threshold: number;
        active: boolean;
      }>,
    ) => ({
      inventory_mode: "tracked",
      stock: 10,
      low_stock_threshold: 5,
      active: true,
      ...q,
    });
    expect(
      lowStockCount([
        p({ stock: 5 }),
        p({ stock: 0 }),
        p({ stock: 6 }),
        p({ stock: 1, active: false }),
        p({ inventory_mode: "made_to_order", stock: 0 }),
        p({ inventory_mode: "unlimited", stock: 0 }),
      ]),
    ).toBe(2);
  });

  it("product ranking spreads refunds over lines, so products sum to Sales", () => {
    const range = {
      from: new Date("2026-11-01T00:00:00Z"),
      to: new Date("2026-11-08T00:00:00Z"),
    };
    const a = order({
      total_minor: 9_000_000,
      refunded_minor: 3_000_000,
      status: "partially_refunded",
      paid_at: "2026-11-02T10:00:00Z",
    });
    const b = order({
      total_minor: 4_500_000,
      paid_at: "2026-11-03T10:00:00Z",
    });
    const old = order({
      total_minor: 4_500_000,
      paid_at: "2026-10-28T10:00:00Z",
    });
    const items = [
      {
        order_id: a.id,
        product_id: "cake",
        name: "Cake",
        quantity: 1,
        line_minor: 6_000_000,
      },
      {
        order_id: a.id,
        product_id: "jar",
        name: "Jar",
        quantity: 2,
        line_minor: 3_000_000,
      },
      {
        order_id: b.id,
        product_id: "jar",
        name: "Jar",
        quantity: 3,
        line_minor: 4_500_000,
      },
      {
        order_id: old.id,
        product_id: "cake",
        name: "Cake",
        quantity: 1,
        line_minor: 4_500_000,
      },
    ];
    const r = productRanking(items, [a, b, old], range);
    expect(r.reduce((s, x) => s + x.sales, 0)).toBe(
      sales(inRange([a, b, old], range)),
    );
    expect(r.map((x) => [x.productId, x.sales, x.units])).toEqual([
      ["jar", 2_000_000 + 4_500_000, 5],
      ["cake", 4_000_000, 1],
    ]);
    expect(r[1].change).toBeCloseTo(4_000_000 / 4_500_000 - 1, 10);
    expect(lineSales(items[0], a)).toBe(4_000_000);
  });
});
