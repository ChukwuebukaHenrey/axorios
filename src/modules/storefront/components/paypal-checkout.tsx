"use client";

import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";

/** The server has already created the PayPal order, so its amount can't be changed from this page. */
export default function PayPalCheckout({
  clientId,
  currency,
  paypalOrderId,
  onApproved,
  onError,
}: {
  clientId: string;
  currency: string;
  paypalOrderId: string;
  onApproved: () => void;
  onError: () => void;
}) {
  return (
    <PayPalScriptProvider options={{ clientId, currency, intent: "capture", components: "buttons" }}>
      <PayPalButtons
        style={{ layout: "vertical", label: "pay" }}
        forceReRender={[paypalOrderId, currency]}
        createOrder={async () => paypalOrderId}
        onApprove={async () => onApproved()}
        onError={onError}
      />
    </PayPalScriptProvider>
  );
}
