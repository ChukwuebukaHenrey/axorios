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
  | { status: "completed"; captureId: string; amountMinor: number; currency: string; payerEmail?: string }
  | { status: "pending"; captureId: string }
  | { status: "not_approved" }
  | { status: "declined" };

export interface PaymentProvider {
  name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Safe to call any number of times for one order. */
  capture(providerOrderId: string): Promise<CaptureResult>;
  /** Returns null unless the provider confirms it really sent this request. */
  verifyWebhook(req: Request): Promise<PaymentEvent | null>;
}
