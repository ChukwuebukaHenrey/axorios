// Step 2.4 against a running app, with two throwaway sellers deleted at the end. Prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/e2e-dashboard.mts [baseUrl]
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const base = process.argv[2] ?? "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

function check(ok: boolean, label: string) {
  if (!ok) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}

async function seller() {
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const suffix = randomBytes(4).toString("hex");
  const email = `dash-${suffix}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`User create failed: ${error?.code}`);
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) throw new Error(`Sign-in failed: ${signInError?.code}`);
  const { data: store, error: storeError } = await admin
    .from("stores")
    .insert({ owner_id: data.user.id, slug: `dash-${suffix}`, currency: "NGN" })
    .select("id")
    .single();
  if (storeError) throw new Error(`Store create failed: ${storeError.code}`);
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(signIn.session)).toString("base64url")}`;
  return { userId: data.user.id, storeId: store.id, cookie };
}

const a = await seller();
const b = await seller();
try {
  const line = (name: string) => [{ productId: "x", name, quantity: 1, unitMinor: 4_500_000, lineMinor: 4_500_000 }];
  const order = {
    store_id: a.storeId,
    total_minor: 4_500_000,
    currency: "NGN",
    charge_total_minor: 3344,
    charge_currency: "USD",
    fx_rate: 0.000743,
    fx_source: "test",
  };
  const { error } = await admin.from("orders").insert([
    { ...order, items: line("Paid Velvet Cake"), status: "paid", channel: "telegram", delivery_note: "For Ada, Ikeja", paid_at: new Date().toISOString() },
    { ...order, items: line("Abandoned Ube Cake"), status: "pending", channel: "web" },
  ]);
  if (error) throw new Error(`Order insert failed: ${error.code}`);

  const page = async (cookie?: string) =>
    fetch(`${base}/dashboard`, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });

  const html = await (await page(a.cookie)).text();
  check(html.includes("Paid Velvet Cake"), "the paid order is listed");
  check(html.includes("₦45,000"), "it shows the owner's amount");
  check(html.includes("$33.44"), "it shows the amount charged");
  check(html.includes("Telegram"), "it shows the channel");
  check(html.includes("For Ada, Ikeja"), "it shows where to deliver");
  check(!html.includes("Abandoned Ube Cake"), "an unpaid cart stays out of the list");

  const other = await (await page(b.cookie)).text();
  check(!other.includes("Paid Velvet Cake") && other.includes("No orders yet"), "another seller can't see it");

  const signedOut = await page();
  check(signedOut.status >= 300 && signedOut.status < 400, "signed out goes to sign-in");
} finally {
  for (const { userId } of [a, b]) {
    await admin.from("stores").delete().eq("owner_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
}
console.log("DONE");
