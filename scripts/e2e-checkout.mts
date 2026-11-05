// Step 2.1 against a running app, on throwaway stores that are deleted at the end. Prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/e2e-checkout.mts [baseUrl]
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const base = process.argv[2] ?? "http://localhost:3100";
const PAYPAL = "https://api-m.sandbox.paypal.com";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

function check(ok: boolean, label: string, detail = "") {
  if (!ok) throw new Error(`FAIL ${label} ${detail}`);
  console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
}

const kit = {
  name: "Checkout Test",
  nameOptions: [],
  tagline: "Test store",
  tone: "Plain",
  palette: { primary: "#222222", secondary: "#444444", accent: "#666666", neutralDark: "#111111", neutralLight: "#FAFAFA" },
  fonts: { heading: "DM Sans", body: "DM Sans" },
  logoUrl: null,
  referenceImageUrls: [],
};

const suffix = randomBytes(4).toString("hex");
const { data: created, error: userError } = await admin.auth.admin.createUser({
  email: `checkout-${suffix}@example.com`,
  password: randomBytes(18).toString("base64url"),
  email_confirm: true,
});
if (userError || !created.user) throw new Error(`User create failed: ${userError?.code}`);
const userId = created.user.id;

async function makeStore(slug: string, status: "live" | "draft", currency: string, priceMinor: number) {
  const { data: store, error } = await admin
    .from("stores")
    .insert({ owner_id: userId, slug, status, currency, brand_kit: kit })
    .select("id")
    .single();
  if (error) throw new Error(`Store create failed: ${error.code}`);
  const { data: product, error: productError } = await admin
    .from("products")
    .insert({ store_id: store.id, name: "Test cake", price_minor: priceMinor, currency, stock: 10 })
    .select("id")
    .single();
  if (productError) throw new Error(`Product create failed: ${productError.code}`);
  return { storeId: store.id, slug, productId: product.id };
}

async function checkout(body: unknown) {
  const res = await fetch(`${base}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, string & number> };
}

async function paypalToken() {
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${PAYPAL}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  return ((await res.json()) as { access_token: string }).access_token;
}

try {
  const gbp = await makeStore(`checkout-gbp-${suffix}`, "live", "GBP", 2550);
  const other = await makeStore(`checkout-other-${suffix}`, "live", "GBP", 100);
  const draft = await makeStore(`checkout-draft-${suffix}`, "draft", "GBP", 100);

  const refused = await checkout({ slug: gbp.slug, items: [{ productId: other.productId, quantity: 1 }] });
  check(refused.status === 400 && refused.body.error === "product_unavailable", "another store's product is refused");

  const unpublished = await checkout({ slug: draft.slug, items: [{ productId: draft.productId, quantity: 1 }] });
  check(unpublished.status === 400 && unpublished.body.error === "store_not_found", "a draft store can't sell");

  const tooMany = await checkout({ slug: gbp.slug, items: [{ productId: gbp.productId, quantity: 11 }] });
  check(tooMany.body.error === "not_enough_stock", "more than the stock is refused");

  const tampered = await checkout({
    slug: gbp.slug,
    totalMinor: 1,
    deliveryNote: "For Ada, 12 Allen Avenue, Ikeja",
    items: [{ productId: gbp.productId, quantity: 2, priceMinor: 1 }],
  });
  check(tampered.status === 200, "checkout opens", `HTTP ${tampered.status}`);
  check(tampered.body.totalMinor === 5100 && tampered.body.chargeMinor === 5100, "a price sent by the client is ignored", "2 x 25.50 = 51.00");

  const token = await paypalToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const paypalId = tampered.body.paypalOrderId;
  const atPayPal = (await (await fetch(`${PAYPAL}/v2/checkout/orders/${paypalId}`, { headers })).json()) as {
    status: string;
    purchase_units: { custom_id: string; amount: { currency_code: string; value: string } }[];
  };
  const unit = atPayPal.purchase_units[0];
  check(unit.amount.value === "51.00" && unit.amount.currency_code === "GBP", "PayPal holds the server's amount", `${unit.amount.value} ${unit.amount.currency_code}`);
  check(unit.custom_id === tampered.body.orderId, "the PayPal order points back at our order");

  const orderUrl = `${base}/s/${gbp.slug}/order/${tampered.body.orderId}`;
  const readOrder = async () => {
    const { data, error } = await admin
      .from("orders")
      .select("status, paypal_capture_id, delivery_note, paid_at")
      .eq("id", tampered.body.orderId)
      .single();
    if (error) throw new Error(`Order read failed: ${error.code}`);
    return data;
  };

  const early = await fetch(orderUrl);
  check(early.status === 200 && (await readOrder()).status === "pending", "opening the page before approval takes no money");

  const foreign = await fetch(`${base}/s/${other.slug}/order/${tampered.body.orderId}`);
  check(foreign.status === 404, "an order can't be opened through another store");

  // Step 2.3: PayPal can't charge naira, so the order converts at a rate it keeps.
  const ngn = await makeStore(`checkout-ngn-${suffix}`, "live", "NGN", 4_500_000);
  const naira = await checkout({ slug: ngn.slug, items: [{ productId: ngn.productId, quantity: 1 }] });
  check(naira.status === 200 && naira.body.currency === "NGN" && naira.body.chargeCurrency === "USD", "an NGN store charges USD", `${naira.body.totalMinor} NGN minor -> ${naira.body.chargeMinor} USD minor`);
  const { data: locked, error: lockedError } = await admin
    .from("orders")
    .select("total_minor, currency, charge_total_minor, charge_currency, fx_rate, fx_source")
    .eq("id", naira.body.orderId)
    .single();
  if (lockedError) throw new Error(`Order read failed: ${lockedError.code}`);
  check(Math.round(locked.total_minor * Number(locked.fx_rate)) === locked.charge_total_minor, "the stored rate explains the charge", `rate ${locked.fx_rate} from ${locked.fx_source}`);
  const nairaAtPayPal = (await (await fetch(`${PAYPAL}/v2/checkout/orders/${naira.body.paypalOrderId}`, { headers })).json()) as typeof atPayPal;
  const amount = nairaAtPayPal.purchase_units[0].amount;
  check(amount.currency_code === "USD" && amount.value === (locked.charge_total_minor / 100).toFixed(2), "PayPal holds the converted amount", `${amount.value} ${amount.currency_code}`);
  check(tampered.body.chargeCurrency === "GBP", "a GBP store charges GBP, with no conversion");
  const { data: direct } = await admin.from("orders").select("fx_rate").eq("id", tampered.body.orderId).single();
  check(direct?.fx_rate === null, "no rate is stored when nothing is converted");

} finally {
  await admin.from("stores").delete().eq("owner_id", userId);
  await admin.auth.admin.deleteUser(userId);
}
console.log("DONE. Capture itself needs a sandbox buyer: this sandbox account refuses test cards.");
