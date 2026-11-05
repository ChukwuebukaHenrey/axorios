import "server-only";
import { paypal } from "./adapters/paypal";
import type { PaymentProvider } from "./types";

export { isChargeable } from "./currency";
export type { CaptureResult, CheckoutRequest, CheckoutSession, PaymentProvider } from "./types";

/** Adding a vendor means one adapter file and one change here. */
export function paymentProvider(): PaymentProvider {
  return paypal;
}
