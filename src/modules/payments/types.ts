import type { PaymentEvent } from "./webhook-event";

export type CheckoutRequest = {
  orderId: string;
  amountMinor: number;
  currency: string;
  description: string;
  brandName: string;
  returnUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = { providerOrderId: string; approveUrl: string };

export type CaptureResult =
  | {
      status: "completed";
      captureId: string;
      amountMinor: number;
      currency: string;
      payerEmail?: string;
      payerCountry?: string;
      /** From PayPal's seller_receivable_breakdown, in the captured currency. */
      feeMinor?: number;
      netMinor?: number;
    }
  | { status: "pending"; captureId: string }
  | { status: "not_approved" }
  | { status: "declined" };

export type RefundRequest = {
  captureId: string;
  /** Omit for a full refund. Captured currency. */
  amountMinor?: number;
  currency: string;
  /** Our refunds row id: sent as PayPal-Request-Id so a retry can't refund twice. */
  requestId: string;
  note?: string;
};

export type RefundResult = {
  refundId: string;
  status: "completed" | "pending" | "failed";
  amountMinor: number;
  currency: string;
  /** PayPal's fee on the refund breakdown, if it reports one. Never assumed. */
  feeReturnedMinor?: number;
};

export type Balance = { currency: string; availableMinor: number; totalMinor: number };

export type ProviderTransaction = {
  id: string;
  eventCode: string;
  status: string;
  at: string;
  amountMinor: number;
  feeMinor: number;
  currency: string;
  /** Our order id, when the transaction carries it (custom_id). */
  customId?: string;
};

export type RefundErrorCode = "already_refunded" | "window_closed" | "insufficient_funds" | "provider_error";

export class RefundError extends Error {
  constructor(
    public readonly code: RefundErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export interface PaymentProvider {
  name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Where a buyer pays for a checkout already created, for sending as a link. */
  checkoutUrl(providerOrderId: string): string;
  /** Safe to call any number of times for one order. */
  capture(providerOrderId: string): Promise<CaptureResult>;
  /** Returns null unless the provider confirms it really sent this request. */
  verifyWebhook(req: Request): Promise<PaymentEvent | null>;
  refund(request: RefundRequest): Promise<RefundResult>;
  /** Whole-account balances (not per store). */
  balances(): Promise<Balance[]>;
  /** Transaction Search: at most 31 days per call; new activity can take hours to appear. */
  transactions(from: Date, to: Date): Promise<ProviderTransaction[]>;
}
