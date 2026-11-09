/** Pure refund rules (spec v2, Money › Refunds). Amounts are in the CAPTURED currency unless named store*. */
import { chargeToStore } from "../analytics/metrics";

/** PayPal's refund window for captures: 180 days from capture. */
export const REFUND_WINDOW_DAYS = 180;

export type RefundableOrder = {
  status: string;
  source: string;
  currency: string;
  total_minor: number;
  tax_minor: number;
  charge_currency: string;
  charge_total_minor: number;
  fx_rate: number | null;
  paypal_capture_id: string | null;
  paid_at: string | null;
  refunded_minor: number;
  refunded_charge_minor: number;
};

export type RefundPlan =
  | {
      ok: true;
      amountMinor: number;
      currency: string;
      storeAmountMinor: number;
      vatReversedMinor: number;
      remainingMinor?: number;
      /** Refunds everything that was captured: sent to PayPal with no amount. */
      full: boolean;
      windowEndsAt?: string;
      /** Whole-account PayPal balance in this currency; null when PayPal didn't answer. */
      balanceMinor?: number | null;
      /** How much to add to PayPal before this refund can go through. */
      shortfallMinor?: number | null;
    }
  | { ok: false; reason: "not_found" | "not_in_paypal" | "not_paid" | "nothing_left" | "exceeds_remaining" | "invalid_amount" | "window_closed" };

export function planRefund(o: RefundableOrder, amountMinor: number | undefined, now: Date, opts: { ignoreWindow?: boolean } = {}): RefundPlan {
  if (!o.paypal_capture_id || (o.source !== "app" && o.source !== "test")) return { ok: false, reason: "not_in_paypal" };
  if (!o.paid_at || !["paid", "partially_refunded"].includes(o.status)) return { ok: false, reason: "not_paid" };
  const windowEnds = Date.parse(o.paid_at) + REFUND_WINDOW_DAYS * 86_400_000;
  if (!opts.ignoreWindow && now.getTime() > windowEnds) return { ok: false, reason: "window_closed" };

  const remaining = o.charge_total_minor - o.refunded_charge_minor;
  if (remaining <= 0) return { ok: false, reason: "nothing_left" };
  const amount = amountMinor ?? remaining;
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: "invalid_amount" };
  if (amount > remaining) return { ok: false, reason: "exceeds_remaining" };

  const storeLeft = o.total_minor - o.refunded_minor;
  // Closing out the order uses what's left exactly, so rounding can't leave a stray kobo.
  const storeAmount = amount === remaining ? storeLeft : Math.min(storeLeft, chargeToStore(o, amount));
  return {
    ok: true,
    amountMinor: amount,
    currency: o.charge_currency,
    storeAmountMinor: storeAmount,
    vatReversedMinor: o.total_minor === 0 ? 0 : Math.round((o.tax_minor * storeAmount) / o.total_minor),
    remainingMinor: remaining,
    full: amount === o.charge_total_minor && o.refunded_charge_minor === 0,
    windowEndsAt: new Date(windowEnds).toISOString(),
  };
}
