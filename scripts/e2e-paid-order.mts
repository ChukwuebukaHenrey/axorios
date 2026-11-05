// Phase 2 on production with a real sandbox payment on /s/demo: capture, dashboard, then a real PayPal event resend.
// Run: npx tsx --env-file=.env.local scripts/e2e-paid-order.mts
import { createClient } from "@supabase/supabase-js";
import { payAsSandboxBuyer } from "./sandbox-pay";

const base = "https://axorios.vercel.app";
const PAYPAL = "https://api-m.sandbox.paypal.com";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

function check(ok: boolean, label: string, detail = "") {
  if (!ok) throw new Error(`FAIL ${label} ${detail}`);
  console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { data: store } = await admin.from("stores").select("id").eq("slug", "demo").single();
const { data: product } = await admin
  .from("products")
  .select("id, name, stock")
  .eq("store_id", store!.id)
  .eq("name", "Red Velvet Celebration Cake")
  .single();
const stock = async () =>
  (await admin.from("products").select("stock").eq("id", product!.id).single()).data!.stock;
const before = await stock();

const note = `E2E ${new Date().toISOString()}: for Ada, Ikeja`;
const res = await fetch(`${base}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ slug: "demo", items: [{ productId: product!.id, quantity: 1 }], deliveryNote: note }),
});
const checkout = (await res.json()) as { orderId: string; paypalOrderId: string; chargeMinor: number; chargeCurrency: string };
check(res.ok, "production checkout opened", `${checkout.chargeMinor} ${checkout.chargeCurrency} minor`);

const landed = await payAsSandboxBuyer(`https://www.sandbox.paypal.com/checkoutnow?token=${checkout.paypalOrderId}`, base);
check(landed.includes(`/s/demo/order/${checkout.orderId}`), "PayPal returned the buyer to the order page");

// The return page captures while it renders, and the webhook may get there first. Fetching it is what a browser did.
const page = await (await fetch(`${base}/s/demo/order/${checkout.orderId}`)).text();
const row = async () => (await admin.from("orders").select("*").eq("id", checkout.orderId).single()).data!;
const paid = await row();
check(paid.status === "paid", "order is paid", paid.status);
check(Boolean(paid.paypal_capture_id), "capture id stored");
check(paid.total_minor === 4_500_000 && paid.currency.trim() === "NGN", "owner amount kept", `${paid.total_minor} ${paid.currency}`);
check(paid.charge_total_minor === checkout.chargeMinor && paid.charge_currency.trim() === "USD", "charged amount kept", `${paid.charge_total_minor} ${paid.charge_currency}`);
check(page.includes("₦45,000"), "order page shows the owner's amount");
const stockAfterPay = await stock();
check(stockAfterPay === before - 1, "stock moved once", `${before} to ${stockAfterPay}`);

// The dashboard, signed in as the demo seller.
const ref = new URL(url).hostname.split(".")[0];
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const { data: signIn } = await anon.auth.signInWithPassword({
  email: process.env.DEMO_SELLER_EMAIL!,
  password: process.env.DEMO_SELLER_PASSWORD!,
});
const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(signIn.session)).toString("base64url")}`;
const dash = await (await fetch(`${base}/dashboard`, { headers: { Cookie: cookie } })).text();
check(dash.includes(note.replace(":", ":")), "paid order is on /dashboard");
check(dash.includes("₦45,000") && dash.includes(`$${(checkout.chargeMinor / 100).toFixed(2)}`), "dashboard shows both amounts");

// Replay: find PayPal's own event for this order and ask PayPal to send it again.
const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
const { access_token } = (await (
  await fetch(`${PAYPAL}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  })
).json()) as { access_token: string };
const headers = { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" };

type WebhookEvent = { id: string; event_type: string; resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } } };
let event: WebhookEvent | undefined;
for (let i = 0; i < 40 && !event; i++) {
  await sleep(6000);
  const list = (await (await fetch(`${PAYPAL}/v1/notifications/webhooks-events?page_size=20`, { headers })).json()) as { events?: WebhookEvent[] };
  event = list.events?.find(
    (e) => e.resource?.id === checkout.paypalOrderId || e.resource?.supplementary_data?.related_ids?.order_id === checkout.paypalOrderId,
  );
}
check(Boolean(event), "PayPal holds an event for this order", event?.event_type);

const eventCount = async () =>
  (await admin.from("webhook_events").select("id", { count: "exact", head: true }).eq("provider", "paypal").eq("event_id", event!.id)).count;
for (let i = 0; i < 20 && !(await eventCount()); i++) await sleep(5000);
check((await eventCount()) === 1, "first delivery recorded once");

const resend = await fetch(`${PAYPAL}/v1/notifications/webhooks-events/${event!.id}/resend`, {
  method: "POST",
  headers,
  body: JSON.stringify({ webhook_ids: [process.env.PAYPAL_WEBHOOK_ID] }),
});
check(resend.ok, "PayPal accepted the resend", `HTTP ${resend.status}`);
await sleep(30_000);

check((await eventCount()) === 1, "the replay added no second event row");
const { count } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("paypal_order_id", checkout.paypalOrderId);
check(count === 1, "one order for this PayPal order");
const after = await row();
check(after.status === "paid" && after.paid_at === paid.paid_at, "still paid, paid time unchanged");
check((await stock()) === stockAfterPay, "stock unchanged by the replay", String(stockAfterPay));
console.log(`Order ${checkout.orderId} PayPal ${checkout.paypalOrderId} event ${event!.id}`);
