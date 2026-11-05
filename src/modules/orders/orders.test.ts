import { describe, expect, it } from "vitest";
import { minorToDecimal } from "../../lib/money";
import { CheckoutBodySchema, CheckoutError, priceCart } from "./schema";

const CAKE = "11111111-1111-4111-8111-111111111111";
const JAR = "22222222-2222-4222-8222-222222222222";
const OTHER_STORE = "33333333-3333-4333-8333-333333333333";

const products = [
  { id: CAKE, name: "Cake", priceMinor: 4_500_000, currency: "NGN", stock: 5 },
  { id: JAR, name: "Jar", priceMinor: 350_000, currency: "NGN", stock: 100 },
];

function errorCode(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof CheckoutError) return error.code;
    throw error;
  }
}

describe("priceCart", () => {
  it("totals from database prices", () => {
    const { totalMinor, currency, lines } = priceCart(products, [
      { productId: CAKE, quantity: 2 },
      { productId: JAR, quantity: 1 },
    ]);
    expect(totalMinor).toBe(9_350_000);
    expect(currency).toBe("NGN");
    expect(lines[0]).toEqual({ productId: CAKE, name: "Cake", quantity: 2, unitMinor: 4_500_000, lineMinor: 9_000_000 });
  });

  it("merges repeated lines and checks stock on the merged quantity", () => {
    const merged = priceCart(products, [
      { productId: CAKE, quantity: 2 },
      { productId: CAKE, quantity: 3 },
    ]);
    expect(merged.lines).toHaveLength(1);
    expect(
      errorCode(() =>
        priceCart(products, [
          { productId: CAKE, quantity: 3 },
          { productId: CAKE, quantity: 3 },
        ]),
      ),
    ).toBe("not_enough_stock");
  });

  it("refuses a product that isn't in this store", () => {
    expect(errorCode(() => priceCart(products, [{ productId: OTHER_STORE, quantity: 1 }]))).toBe("product_unavailable");
  });

  it("refuses an order worth nothing", () => {
    const free = [{ id: CAKE, name: "Free", priceMinor: 0, currency: "USD", stock: 5 }];
    expect(errorCode(() => priceCart(free, [{ productId: CAKE, quantity: 1 }]))).toBe("empty_total");
  });
});

describe("CheckoutBodySchema", () => {
  const base = { slug: "demo", items: [{ productId: CAKE, quantity: 1 }] };

  it("strips any amount a client sends", () => {
    const parsed = CheckoutBodySchema.parse({
      ...base,
      totalMinor: 1,
      items: [{ productId: CAKE, quantity: 1, priceMinor: 1 }],
    });
    expect(parsed).toEqual(base);
  });

  it("refuses bad quantities and empty carts", () => {
    expect(CheckoutBodySchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(CheckoutBodySchema.safeParse({ ...base, items: [{ productId: CAKE, quantity: 0 }] }).success).toBe(false);
    expect(CheckoutBodySchema.safeParse({ ...base, items: [{ productId: CAKE, quantity: 1.5 }] }).success).toBe(false);
    expect(CheckoutBodySchema.safeParse({ ...base, items: [{ productId: "x", quantity: 1 }] }).success).toBe(false);
  });
});

describe("minorToDecimal", () => {
  it("follows each currency's decimals", () => {
    expect(minorToDecimal(4500, "USD")).toBe("45.00");
    expect(minorToDecimal(5, "USD")).toBe("0.05");
    expect(minorToDecimal(4500, "JPY")).toBe("4500");
    expect(minorToDecimal(1234, "KWD")).toBe("1.234");
  });

  it("refuses anything that isn't a whole non-negative amount", () => {
    expect(() => minorToDecimal(1.5, "USD")).toThrow();
    expect(() => minorToDecimal(-1, "USD")).toThrow();
  });
});
