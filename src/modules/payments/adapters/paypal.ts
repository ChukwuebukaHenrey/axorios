import "server-only";
import { env } from "@/lib/env";
import { minorToDecimal, parseToMinor } from "@/lib/money";
import type { CaptureResult, PaymentProvider } from "../types";
import { parsePayPalEvent } from "../webhook-event";

const BASE = "https://api-m.sandbox.paypal.com";

let token: { value: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  const e = env();
  const basic = Buffer.from(`${e.PAYPAL_CLIENT_ID}:${e.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal token failed: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return token.value;
}

async function call(path: string, init: { method: string; body?: unknown; requestId?: string }) {
  return fetch(`${BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...(init.requestId && { "PayPal-Request-Id": init.requestId }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

type PayPalOrder = {
  id: string;
  status: string;
  links?: { rel: string; href: string }[];
  payer?: { email_address?: string };
  purchase_units?: {
    payments?: { captures?: { id: string; status: string; amount: { currency_code: string; value: string } }[] };
  }[];
};

function fromOrder(order: PayPalOrder): CaptureResult {
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) return { status: "not_approved" };
  if (capture.status === "PENDING") return { status: "pending", captureId: capture.id };
  if (capture.status !== "COMPLETED") return { status: "declined" };
  const currency = capture.amount.currency_code;
  return {
    status: "completed",
    captureId: capture.id,
    currency,
    amountMinor: parseToMinor(capture.amount.value, currency),
    payerEmail: order.payer?.email_address,
  };
}

async function getOrder(id: string): Promise<PayPalOrder> {
  const res = await call(`/v2/checkout/orders/${encodeURIComponent(id)}`, { method: "GET" });
  if (!res.ok) throw new Error(`PayPal order read failed: HTTP ${res.status}`);
  return (await res.json()) as PayPalOrder;
}

export const paypal: PaymentProvider = {
  name: "paypal",

  async createCheckout(request) {
    const res = await call("/v2/checkout/orders", {
      method: "POST",
      requestId: `create-${request.orderId}`,
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: request.orderId,
            description: request.description.slice(0, 127),
            amount: {
              currency_code: request.currency,
              value: minorToDecimal(request.amountMinor, request.currency),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: request.brandName.slice(0, 127),
              // Delivery details are taken on the store: the buyer's address is often not where the order goes.
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: request.returnUrl,
              cancel_url: request.cancelUrl,
              // Fixed, not storeLanguage: this is the buyer's checkout page, and the buyer's own account
              // locale (observed as Arabic for the sandbox buyer) otherwise overrides PayPal's default.
              locale: "en-US",
            },
          },
        },
      },
    });
    if (!res.ok) throw new Error(`PayPal order create failed: HTTP ${res.status}`);
    const order = (await res.json()) as PayPalOrder;
    const approveUrl = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
    if (!approveUrl) throw new Error("PayPal order has no approval link");
    return { providerOrderId: order.id, approveUrl };
  },

  checkoutUrl(providerOrderId) {
    return `https://www.sandbox.paypal.com/checkoutnow?token=${encodeURIComponent(providerOrderId)}`;
  },

  async capture(providerOrderId) {
    // Read first: a capture attempted before approval must not be replayed under the same request ID afterwards.
    const current = await getOrder(providerOrderId);
    if (current.status === "COMPLETED") return fromOrder(current);
    if (current.status !== "APPROVED") return { status: "not_approved" };

    const res = await call(`/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`, {
      method: "POST",
      body: {},
      requestId: `capture-${providerOrderId}`,
    });
    if (res.ok) return fromOrder((await res.json()) as PayPalOrder);

    const failure = (await res.json().catch(() => null)) as { details?: { issue?: string }[] } | null;
    const issue = failure?.details?.[0]?.issue;
    if (issue === "ORDER_ALREADY_CAPTURED") return fromOrder(await getOrder(providerOrderId));
    if (issue === "INSTRUMENT_DECLINED" || issue === "PAYER_ACTION_REQUIRED") return { status: "declined" };
    throw new Error(`PayPal capture failed: HTTP ${res.status} ${issue ?? ""}`.trim());
  },

  async verifyWebhook(req) {
    const webhookId = env().PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.error("PAYPAL_WEBHOOK_ID is not set, so PayPal webhooks are refused");
      return null;
    }
    const raw = await req.text();
    const fields = {
      auth_algo: req.headers.get("paypal-auth-algo"),
      cert_url: req.headers.get("paypal-cert-url"),
      transmission_id: req.headers.get("paypal-transmission-id"),
      transmission_sig: req.headers.get("paypal-transmission-sig"),
      transmission_time: req.headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
    };
    if (Object.values(fields).some((value) => !value)) return null;

    const event = parsePayPalEvent(raw);
    if (!event) return null;

    // The event goes back byte for byte: parsing and re-serialising it can break the signature.
    const res = await fetch(`${BASE}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
      body: `${JSON.stringify(fields).slice(0, -1)},"webhook_event":${raw}}`,
    });
    if (!res.ok) throw new Error(`PayPal webhook check failed: HTTP ${res.status}`);
    const { verification_status: status } = (await res.json()) as { verification_status?: string };
    return status === "SUCCESS" ? event : null;
  },
};
