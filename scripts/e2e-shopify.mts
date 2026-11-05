// Step 4.4 on production as the demo seller, through the real agent, approvals and Inngest job, against the Shopify dev store.
// Leaves the demo store connected and its catalog in Shopify, as the demo needs. Prints no credentials or tokens.
// Run: npx tsx --env-file=.env.local scripts/e2e-shopify.mts
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const base = "https://axorios.vercel.app";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function check(ok: boolean, label: string, detail = "") {
  if (!ok) throw new Error(`FAIL ${label} ${detail}`);
  console.log(`PASS ${label}${detail ? ` (${detail})` : ""}`);
}

// Our own direct view of Shopify, to check what the app did.
const grant = (await (
  await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.SHOPIFY_CLIENT_ID!, client_secret: process.env.SHOPIFY_CLIENT_SECRET! }),
  })
).json()) as { access_token: string };
async function shopify<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${domain}/admin/api/2026-10/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": grant.access_token },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data: T; errors?: unknown };
  if (body.errors) throw new Error(`Shopify: ${JSON.stringify(body.errors)}`);
  return body.data;
}
type ShopProduct = { id: string; handle: string; title: string; variants: { nodes: { id: string; price: string; inventoryQuantity: number }[] } };
const demoProducts = async () =>
  (
    await shopify<{ products: { nodes: ShopProduct[] } }>(`{ products(first: 100, query: "handle:demo-*") {
      nodes { id handle title variants(first: 1) { nodes { id price inventoryQuantity } } } } }`)
  ).products.nodes.filter((p) => p.handle.startsWith("demo-"));

type Msg = { id: string; role: string; parts: Record<string, unknown>[] };
const sessionCookie = async (email: string, password: string) => {
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.code}`);
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}`;
};
async function agent(cookie: string, messages: Msg[]) {
  const res = await fetch(`${base}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`Agent HTTP ${res.status}`);
  return (await res.text())
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)));
}
/** Asks, runs a check while the card is waiting, then answers the way the card does. Returns the tool's output. */
async function withApproval(cookie: string, tool: string, text: string, whileWaiting: () => Promise<void>, approved = true) {
  const first: Msg = { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text }] };
  const events = await agent(cookie, [first]);
  const call = events.find((e) => e.type === "tool-input-available" && e.toolName === tool);
  const request = events.find((e) => e.type === "tool-approval-request");
  check(Boolean(call && request), `${tool} asks for approval first`);
  await whileWaiting();
  const answered = await agent(cookie, [
    first,
    {
      id: crypto.randomUUID(),
      role: "assistant",
      parts: [
        { type: "step-start" },
        { type: `tool-${tool}`, toolCallId: call.toolCallId, state: "approval-responded", input: call.input, approval: { id: request.approvalId, approved } },
      ],
    },
  ]);
  return answered.find((e) => e.type === "tool-output-available")?.output as Record<string, unknown> | undefined;
}

const { data: store, error: storeError } = await admin.from("stores").select("id").eq("slug", "demo").single();
if (storeError || !store) throw new Error(`Demo store read failed: ${storeError?.code}`);
const { data: session } = await admin.from("agent_sessions").select("id, messages").eq("store_id", store.id).limit(1).maybeSingle();
const connection = async () =>
  (await admin.from("platform_connections").select("*").eq("store_id", store.id).maybeSingle()).data as {
    shop_domain: string; access_token: string; token_expires_at: string | null; last_synced_at: string | null; external_ids: { products?: Record<string, string>; collection?: string; pages?: Record<string, string> }; last_sync_result: Record<string, unknown> | null;
  } | null;

async function waitForSync(after: string | null) {
  const started = Date.now();
  while (Date.now() - started < 150_000) {
    const row = await connection();
    const result = row?.last_sync_result;
    if (result && (!after || String(result.at) > after)) return row!;
    await sleep(3000);
  }
  throw new Error("FAIL sync did not finish in time");
}

const suffix = randomBytes(4).toString("hex");
const strangerEmail = `shopify-${suffix}@example.com`;
const strangerPassword = randomBytes(18).toString("base64url");
const { data: stranger, error: userError } = await admin.auth.admin.createUser({ email: strangerEmail, password: strangerPassword, email_confirm: true });
if (userError || !stranger.user) throw new Error(`User create failed: ${userError?.code}`);

let exit = 0;
try {
  console.log("1. Another seller can't reach the dev store");
  await admin.from("stores").insert({
    owner_id: stranger.user.id,
    slug: `shopify-${suffix}`,
    brand_kit: { name: "Stranger", nameOptions: [], tagline: "x", tone: "x", palette: { primary: "#222222", secondary: "#444444", accent: "#666666", neutralDark: "#111111", neutralLight: "#FAFAFA" }, fonts: { heading: "DM Sans", body: "DM Sans" }, logoUrl: null, referenceImageUrls: [] },
  });
  const strangerCookie = await sessionCookie(strangerEmail, strangerPassword);
  const refused = await withApproval(strangerCookie, "connect_shopify", `Connect my Shopify store ${domain}`, async () => {});
  check(refused?.error === "shop_not_available", "a stranger's connect is refused", JSON.stringify(refused));

  const cookie = await sessionCookie(process.env.DEMO_SELLER_EMAIL!, process.env.DEMO_SELLER_PASSWORD!);
  await admin.from("platform_connections").delete().eq("store_id", store.id);

  console.log("2. Denying connects nothing");
  await withApproval(cookie, "connect_shopify", `Connect my Shopify store ${domain}`, async () => {}, false);
  check((await connection()) === null, "a denied connect saves nothing");

  console.log("3. Connect");
  const connected = await withApproval(cookie, "connect_shopify", `Connect my Shopify store ${domain}`, async () => {
    check((await connection()) === null, "nothing is saved while the card waits");
  });
  check(connected?.shopDomain === domain, "connected", String(connected?.shopName));
  const row = await connection();
  check(row?.access_token.split(".").length === 3 && !row.access_token.startsWith("shpat"), "the stored token is encrypted");
  check(Boolean(row?.token_expires_at), "its expiry is stored");

  console.log("4. First sync");
  const catalog = (await admin.from("products").select("id, name, price_minor, currency, stock").eq("store_id", store.id).eq("active", true)).data ?? [];
  await withApproval(cookie, "sync_to_shopify", "Sync my store to Shopify", async () => {
    check((await connection())?.last_synced_at === null, "nothing runs while the card waits");
  });
  const first = await waitForSync(null);
  if (first.last_sync_result?.error) throw new Error(`FAIL sync error: ${first.last_sync_result.error}`);
  console.log(`  result: ${JSON.stringify({ ...first.last_sync_result, theme: undefined })}`);
  const afterFirst = await demoProducts();
  check(afterFirst.length === catalog.length, "every product is in Shopify", `${afterFirst.length} of ${catalog.length}`);

  const sample = catalog.find((p) => p.currency === "NGN");
  if (sample) {
    const mapped = first.external_ids.products?.[sample.id];
    const shopProduct = afterFirst.find((p) => p.id === mapped);
    const price = Number(shopProduct?.variants.nodes[0]?.price);
    const naira = sample.price_minor / 100;
    check(price > naira / 3000 && price < naira / 500, "the naira price was converted to the shop's USD", `₦${naira} became $${price}`);
    check(shopProduct?.variants.nodes[0]?.inventoryQuantity === sample.stock, "stock matches", String(sample.stock));
  }
  const pageIds = Object.values(first.external_ids.pages ?? {});
  check(pageIds.length >= 1 && Boolean(first.external_ids.collection), "a collection and pages were created", `${pageIds.length} pages`);
  const theme = first.last_sync_result?.theme as { editorUrl: string; palette: object } | undefined;
  check(Boolean(theme?.editorUrl.includes("/themes")) && Object.keys(theme?.palette ?? {}).length === 5, "the theme editor link and colours are given", theme?.editorUrl);

  console.log("5. Second sync updates and doesn't duplicate");
  const victim = afterFirst[0];
  const correctPrice = victim.variants.nodes[0].price;
  await shopify(
    `mutation Tamper($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { message } } }`,
    { productId: victim.id, variants: [{ id: victim.variants.nodes[0].id, price: "1.00" }] },
  );
  await withApproval(cookie, "sync_to_shopify", "Sync to Shopify again", async () => {});
  const second = await waitForSync(String(first.last_sync_result?.at));
  if (second.last_sync_result?.error) throw new Error(`FAIL sync error: ${second.last_sync_result.error}`);
  const afterSecond = await demoProducts();
  check(afterSecond.length === afterFirst.length, "still the same number of products", String(afterSecond.length));
  check(afterSecond.map((p) => p.id).sort().join() === afterFirst.map((p) => p.id).sort().join(), "the very same products");
  const repaired = Number(afterSecond.find((p) => p.id === victim.id)?.variants.nodes[0].price);
  check(Math.abs(repaired - Number(correctPrice)) < 0.05, "a price changed in Shopify was put back by the sync", `$1.00 back to $${repaired}`);
  check(second.external_ids.collection === first.external_ids.collection, "the same collection");
  check(JSON.stringify(second.external_ids.pages) === JSON.stringify(first.external_ids.pages), "the same pages");
  const { collection } = await shopify<{ collection: { productsCount: { count: number } } }>(
    `query C($id: ID!) { collection(id: $id) { productsCount { count } } }`,
    { id: second.external_ids.collection },
  );
  check(collection.productsCount.count === catalog.length, "the collection holds every product once", String(collection.productsCount.count));
  console.log("ALL PASS");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exit = 1;
} finally {
  await admin.auth.admin.deleteUser(stranger.user.id);
  if (session) await admin.from("agent_sessions").update({ messages: session.messages }).eq("id", session.id);
  console.log("cleanup done");
}
process.exit(exit);
