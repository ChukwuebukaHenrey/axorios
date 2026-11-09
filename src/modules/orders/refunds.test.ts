import { describe, expect, it } from "vitest";
import { planRefund, type RefundableOrder } from "./refund-plan";

const order: RefundableOrder = {
  status: "paid",
  source: "app",
  currency: "NGN",
  total_minor: 4_500_000,
  tax_minor: 313_953,
  charge_currency: "USD",
  charge_total_minor: 3344,
  fx_rate: 0.0007431,
  paypal_capture_id: "CAP1",
  paid_at: "2026-11-05T14:00:00Z",
  refunded_minor: 0,
  refunded_charge_minor: 0,
};
const now = new Date("2026-11-09T12:00:00Z");

describe("refund rules", () => {
  it("full refund: captured amount, all of the store total and VAT, sent with no amount", () => {
    expect(planRefund(order, undefined, now)).toMatchObject({ ok: true, amountMinor: 3344, currency: "USD", storeAmountMinor: 4_500_000, vatReversedMinor: 313_953, full: true });
  });
  it("partial refund converts at the original rate and reverses VAT pro rata", () => {
    const p = planRefund(order, 1000, now);
    expect(p).toMatchObject({ ok: true, amountMinor: 1000, full: false });
    if (p.ok) {
      expect(p.storeAmountMinor).toBe(Math.round((1000 / 0.0007431) * 1)); // ₦13,457.14
      expect(p.vatReversedMinor).toBe(Math.round((313_953 * p.storeAmountMinor) / 4_500_000));
    }
  });
  it("a partial larger than what's left is refused", () => {
    expect(planRefund({ ...order, status: "partially_refunded", refunded_charge_minor: 3000, refunded_minor: 4_037_000 }, 500, now)).toEqual({ ok: false, reason: "exceeds_remaining" });
  });
  it("the last partial closes out the store total exactly", () => {
    const p = planRefund({ ...order, status: "partially_refunded", refunded_charge_minor: 1000, refunded_minor: 1_345_714 }, 2344, now);
    expect(p).toMatchObject({ ok: true, storeAmountMinor: 4_500_000 - 1_345_714, full: false });
  });
  it("imported and seeded orders were never in PayPal", () => {
    expect(planRefund({ ...order, source: "import" }, undefined, now)).toEqual({ ok: false, reason: "not_in_paypal" });
  });
  it("fully refunded orders have nothing left", () => {
    expect(planRefund({ ...order, status: "refunded", refunded_charge_minor: 3344 }, undefined, now)).toEqual({ ok: false, reason: "not_paid" });
  });
  it("the window closes 180 days after capture", () => {
    expect(planRefund(order, undefined, new Date("2027-05-05T14:00:01Z"))).toEqual({ ok: false, reason: "window_closed" });
  });
  it("rejects zero or fractional amounts", () => {
    expect(planRefund(order, 0, now)).toEqual({ ok: false, reason: "invalid_amount" });
    expect(planRefund(order, 1.5, now)).toEqual({ ok: false, reason: "invalid_amount" });
  });
});
