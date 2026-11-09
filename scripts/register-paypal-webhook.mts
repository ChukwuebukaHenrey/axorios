// Registers the production PayPal sandbox webhook and prints its ID. Safe to re-run: reuses a match.
// Run: npx tsx --env-file=.env.local scripts/register-paypal-webhook.mts
const BASE = "https://api-m.sandbox.paypal.com";
const URL_ = "https://axorios.vercel.app/api/webhooks/paypal";
const EVENTS = ["CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.REFUNDED"];

const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
if (!tokenRes.ok) throw new Error(`Token failed: HTTP ${tokenRes.status}`);
const { access_token } = (await tokenRes.json()) as { access_token: string };
const headers = { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" };

const list = (await (await fetch(`${BASE}/v1/notifications/webhooks`, { headers })).json()) as {
  webhooks?: { id: string; url: string }[];
};
let id = list.webhooks?.find((w) => w.url === URL_)?.id;
if (!id) {
  const res = await fetch(`${BASE}/v1/notifications/webhooks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url: URL_, event_types: EVENTS.map((name) => ({ name })) }),
  });
  if (!res.ok) throw new Error(`Create failed: HTTP ${res.status} ${await res.text()}`);
  id = ((await res.json()) as { id: string }).id;
} else {
  // Keep the subscription in step with EVENTS (6.7 added refunds).
  const res = await fetch(`${BASE}/v1/notifications/webhooks/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify([{ op: "replace", path: "/event_types", value: EVENTS.map((name) => ({ name })) }]),
  });
  if (!res.ok) throw new Error(`Update failed: HTTP ${res.status} ${await res.text()}`);
}
console.log(id);
