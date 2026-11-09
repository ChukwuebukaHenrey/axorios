import "server-only";
import { paypal } from "./adapters/paypal";
import type { PaymentProvider } from "./types";

export { isChargeable } from "./currency";
export { quote } from "./quote";
export type { Quote } from "./quote";
export { RefundError } from "./types";
export type {
  Balance,
  CaptureResult,
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  ProviderTransaction,
  RefundErrorCode,
  RefundRequest,
  RefundResult,
} from "./types";
export type { PaymentEvent } from "./webhook-event";

/** Adding a vendor means one adapter file and one change here. */
export function paymentProvider(): PaymentProvider {
  return paypal;
}
