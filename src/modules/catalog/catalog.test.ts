import { describe, expect, it } from "vitest";
import { formatMinor, parseToMinor } from "../../lib/money";
import { AddProductsSchema, assertSameCurrency, planUpsert, toProductWrites } from "./schema";

describe("minor units per currency", () => {
  it("uses 2 decimals for naira, dollars and pounds", () => {
    expect(parseToMinor("45000", "NGN")).toBe(4_500_000);
    expect(parseToMinor("12.50", "USD")).toBe(1250);
    expect(parseToMinor("19.99", "GBP")).toBe(1999);
  });

  it("uses 0 decimals for JPY, HUF and TWD", () => {
    expect(parseToMinor("4500", "JPY")).toBe(4500);
    expect(parseToMinor("4500", "HUF")).toBe(4500);
    expect(parseToMinor("4500", "TWD")).toBe(4500);
  });

  it("uses 3 decimals for KWD", () => {
    expect(parseToMinor("1.250", "KWD")).toBe(1250);
  });

  it("has no floating point error", () => {
    expect(parseToMinor("1.15", "USD")).toBe(115);
    expect(parseToMinor("4.35", "USD")).toBe(435);
    expect(parseToMinor("1001.10", "USD")).toBe(100110);
  });

  it("accepts commas and trailing zeros", () => {
    expect(parseToMinor("45,000", "NGN")).toBe(4_500_000);
    expect(parseToMinor("4500.00", "JPY")).toBe(4500);
  });

  it("rejects what it can't represent", () => {
    expect(() => parseToMinor("12.5", "JPY")).toThrow();
    expect(() => parseToMinor("1.999", "USD")).toThrow();
    expect(() => parseToMinor("-5", "USD")).toThrow();
    expect(() => parseToMinor("about 500", "USD")).toThrow();
    expect(() => parseToMinor("99999999999999999", "USD")).toThrow();
  });

  it("formats for display", () => {
    expect(formatMinor(4_500_000, "NGN")).toBe("₦45,000");
    expect(formatMinor(1250, "USD")).toBe("$12.50");
    expect(formatMinor(4500, "JPY")).toBe("¥4,500");
  });
});

describe("add_products input", () => {
  it("rejects a currency that isn't ISO", () => {
    const result = AddProductsSchema.safeParse({ currency: "NAIRA", products: [{ name: "Cake", price: "1" }] });
    expect(result.success).toBe(false);
  });

  it("carries the batch's currency into minor units", () => {
    const writes = toProductWrites({
      currency: "NGN",
      products: [
        { name: "Red Velvet", price: "45000" },
        { name: "Ube Cake", price: "30,000", stock: 3 },
      ],
    });
    expect(writes.map((w) => w.priceMinor)).toEqual([4_500_000, 3_000_000]);
    expect(writes[1].stock).toBe(3);
  });

  it("fails the whole batch on one bad price", () => {
    expect(() =>
      toProductWrites({
        currency: "USD",
        products: [
          { name: "A", price: "5" },
          { name: "B", price: "ask me" },
        ],
      }),
    ).toThrow();
  });

  it("keeps the last of a repeated name in one batch", () => {
    const writes = toProductWrites({
      currency: "USD",
      products: [
        { name: "Cake", price: "5" },
        { name: " cake", price: "7" },
      ],
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].priceMinor).toBe(700);
  });
});

describe("saving twice", () => {
  const writes = toProductWrites({
    currency: "USD",
    products: [
      { name: "Red  Velvet", price: "5" },
      { name: "New Cake", price: "7" },
    ],
  });

  it("updates a known name and inserts a new one", () => {
    const { updates, inserts } = planUpsert(writes, [{ id: "p1", name: "red velvet" }]);
    expect(updates.map((u) => u.id)).toEqual(["p1"]);
    expect(inserts.map((i) => i.name)).toEqual(["New Cake"]);
  });

  it("refuses a second currency in one store", () => {
    expect(() => assertSameCurrency(["NGN"], "USD")).toThrow(/NGN/);
    expect(() => assertSameCurrency(["NGN", "NGN"], "NGN")).not.toThrow();
    expect(() => assertSameCurrency([], "NGN")).not.toThrow();
  });
});
