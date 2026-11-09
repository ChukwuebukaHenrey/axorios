// Step 6.9: contacts, consent from checkout, labels with the delete guard, merge suggestions, export, Inbox chips.
// Server part runs the customers module directly; UI part drives headless Edge against http://localhost:3100.
// Run: npx tsx --import ./scripts/no-server-only.mjs --env-file=.env.local scripts/e2e-customers.mts [baseUrl]
import { createClient } from "@supabase/supabase-js";
import {
  contactFromCheckout,
  CustomerError,
  deleteLabel,
} from "../src/modules/customers/index";
import { check, openEdge } from "./edge";

const base =
  process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const { data: store } = await admin
  .from("stores")
  .select("id")
  .eq("slug", "demo")
  .single();
const storeId = store!.id;

// ── Contact from checkout gets consent rows (idempotent) ──
const { data: tmpl } = await admin
  .from("orders")
  .select("*")
  .eq("store_id", storeId)
  .eq("source", "test")
  .limit(1)
  .single();
const copy: Record<string, unknown> = { ...tmpl! };
for (const k of ["id", "created_at", "updated_at"]) delete copy[k];
const { data: order, error: oErr } = await admin
  .from("orders")
  .insert({
    ...copy,
    status: "pending",
    paid_at: null,
    contact_id: null,
    paypal_order_id: null,
    paypal_capture_id: null,
    customer_ref: null,
    delivery_note: "E2E customers",
  })
  .select("id")
  .single();
if (oErr) throw new Error(`order insert: ${oErr.code}`);
const email = `e2e+${Date.now()}@example.com`;
let contactId: string | null = null;
try {
  contactId = await contactFromCheckout(storeId, {
    orderId: order!.id,
    email: email.toUpperCase(),
    country: "GB",
  });
  const again = await contactFromCheckout(storeId, {
    orderId: order!.id,
    email,
    country: "GB",
  });
  check(
    contactId && again === contactId,
    "same contact on a repeat call (email matched case-blind)",
  );
  const { data: contact } = await admin
    .from("contacts")
    .select("source, email, country")
    .eq("id", contactId!)
    .single();
  check(
    contact!.source === "checkout" &&
      contact!.email === email &&
      contact!.country === "GB",
    "contact created with source checkout",
  );
  const { data: consents } = await admin
    .from("contact_consents")
    .select("channel, marketing, source")
    .eq("contact_id", contactId!);
  check(
    consents!.length === 1 &&
      consents![0].channel === "email" &&
      consents![0].marketing === false &&
      consents![0].source === "checkout",
    `one consent row: email, order updates only (${JSON.stringify(consents)})`,
  );
  const { data: linked } = await admin
    .from("orders")
    .select("contact_id")
    .eq("id", order!.id)
    .single();
  check(linked!.contact_id === contactId, "order linked to the contact");
} finally {
  await admin.from("orders").delete().eq("id", order!.id);
  if (contactId) await admin.from("contacts").delete().eq("id", contactId);
}

// ── Label delete guard (module) ──
const { data: guarded } = await admin
  .from("labels")
  .select("id")
  .eq("store_id", storeId)
  .eq("name", "Birthday regular")
  .single();
try {
  await deleteLabel(storeId, guarded!.id);
  check(false, "guarded label delete refused");
} catch (e) {
  check(
    e instanceof CustomerError &&
      e.code === "label_in_use" &&
      e.detail?.includes("Weekend specials for regulars"),
    "module refuses to delete a label used by a scheduled campaign, naming it",
  );
}
const { data: other } = await admin
  .from("stores")
  .select("id")
  .eq("slug", "eko-sweet-kitchen-uk")
  .single();
try {
  await deleteLabel(other!.id, guarded!.id);
  check(false, "other store refused");
} catch (e) {
  check(
    e instanceof CustomerError && e.code === "not_found",
    "another store can't touch this store's label",
  );
}

// ── UI ──
const b = await openEdge(base);
try {
  await b.go(
    "/dashboard/customers",
    `document.querySelectorAll('[data-contact]').length > 0`,
  );
  check(
    await b.evaluate<boolean>(
      `!!document.querySelector('a[href="/dashboard/customers"]') && ![...document.querySelectorAll('a[href="/dashboard/customers"]')].some(a => a.textContent.toLowerCase().includes('soon'))`,
    ),
    "Customers is live in the sidebar",
  );
  check(
    (await b.evaluate<number>(
      `document.querySelectorAll('[data-contact]').length`,
    )) === 25,
    "contacts page shows 25 rows",
  );
  await b.shot("customers-1280");
  await b.go(
    `/dashboard/customers?label=${guarded!.id}`,
    `document.querySelectorAll('[data-contact]').length > 0`,
  );
  check(
    await b.evaluate<boolean>(
      `[...document.querySelectorAll('[data-contact]')].every(r => r.textContent.includes('Birthday regular'))`,
    ),
    "label filter: every row has the label",
  );

  const first = await b.evaluate<string>(
    `document.querySelector('[data-contact]').getAttribute('data-contact')`,
  );
  await b.go(`/dashboard/customers/${first}`, `!!document.querySelector('h1')`);
  await new Promise((r) => setTimeout(r, 2500)); // hydration
  check(
    await b.evaluate<boolean>(
      `document.body.textContent.includes('Consent') && document.body.textContent.includes('Data & privacy')`,
    ),
    "profile: consent and privacy sections",
  );
  const res = await fetch(`${base}/dashboard/customers/${first}/export`, {
    headers: { cookie: b.cookie.header },
    redirect: "manual",
  });
  const body = res.ok
    ? ((await res.json()) as { contact: { id: string } })
    : null;
  check(
    res.status === 200 && body?.contact.id === first,
    `export returns the contact as JSON (${res.status})`,
  );
  const foreign = await fetch(
    `${base}/dashboard/customers/00000000-0000-4000-8000-000000000000/export`,
    { headers: { cookie: b.cookie.header }, redirect: "manual" },
  );
  check(foreign.status === 404, "export of an unknown contact is 404");

  // Toggle a label on the profile, then back.
  const chip = `[...document.querySelectorAll('button[aria-pressed]')].find(x => x.textContent.trim() === 'Wholesale')`;
  const before = await b.evaluate<string>(
    `${chip}.getAttribute('aria-pressed')`,
  );
  await b.evaluate(`${chip}.click()`);
  check(
    await b.waitFor(
      `${chip}.getAttribute('aria-pressed') !== ${JSON.stringify(before)}`,
      20_000,
    ),
    "label toggles on the profile",
  );
  await b.waitFor(`!${chip}.disabled`, 20_000);
  await b.evaluate(`${chip}.click()`);
  check(
    await b.waitFor(
      `${chip}.getAttribute('aria-pressed') === ${JSON.stringify(before)} && !${chip}.disabled`,
      30_000,
    ),
    "and back",
  );
  await b.shot("customer-profile-1280");

  // Labels tab: create, delete; the guarded one is blocked in the UI with the campaign's name.
  await b.go(
    "/dashboard/customers?tab=labels",
    `!!document.querySelector('#new-label')`,
  );
  await new Promise((r) => setTimeout(r, 3000)); // hydration
  await b.evaluate(`document.querySelector('#new-label').focus()`);
  await b.send("Input.insertText", { text: "E2E temp" });
  await b.evaluate(
    `document.querySelector('#new-label').form.querySelector('button[type=submit]').click()`,
  );
  check(
    await b.waitFor(
      `!!document.querySelector('[data-label="E2E temp"]')`,
      20_000,
    ),
    "label created",
  );
  await b.evaluate(
    `document.querySelector('[data-label="E2E temp"] button[aria-label^="Delete"]').click()`,
  );
  await b.waitFor(`!!document.querySelector('[role="dialog"]')`);
  await b.evaluate(
    `[...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'Delete').click()`,
  );
  check(
    await b.waitFor(
      `!document.querySelector('[data-label="E2E temp"]')`,
      20_000,
    ),
    "unused label deleted",
  );
  await b.evaluate(
    `document.querySelector('[data-label="Birthday regular"] button[aria-label^="Delete"]').click()`,
  );
  await b.waitFor(`!!document.querySelector('[role="dialog"]')`);
  await b.evaluate(
    `[...document.querySelectorAll('[role="dialog"] button')].find(x => x.textContent.trim() === 'Delete').click()`,
  );
  check(
    await b.waitFor(
      `!!document.querySelector('[role="dialog"] [role="alert"]') && document.querySelector('[role="dialog"] [role="alert"]').textContent.includes('Weekend specials for regulars')`,
      20_000,
    ),
    "UI blocks deleting the guarded label and names the campaign",
  );
  await b.shot("labels-guard-1280");
  const { count } = await admin
    .from("labels")
    .select("*", { count: "exact", head: true })
    .eq("id", guarded!.id);
  check(count === 1, "guarded label still exists");

  await b.go(
    "/dashboard/customers?tab=duplicates",
    `document.readyState === 'complete'`,
  );
  check(
    await b.evaluate<boolean>(
      `document.body.textContent.includes('Merging keeps the older contact')`,
    ),
    "duplicates tab renders",
  );
  await b.go("/dashboard/inbox", `document.readyState === 'complete'`);
  console.log(
    `info inbox threads with label chips: ${await b.evaluate<number>(`document.querySelectorAll('[data-thread-labels]').length`)}`,
  );

  await b.phone();
  for (const path of [
    "/dashboard/customers",
    `/dashboard/customers/${first}`,
  ]) {
    await b.go(path, `document.readyState === 'complete'`);
    await new Promise((r) => setTimeout(r, 800));
    check(
      await b.evaluate<boolean>(
        `document.documentElement.scrollWidth <= window.innerWidth + 1`,
      ),
      `no sideways scroll at 390 px: ${path}`,
    );
  }
  const errors = b.consoleErrors.filter(
    (e) => !/license|licence|watermark|trial|^[\s*]*$/i.test(e),
  );
  if (errors.length) console.log(errors.join(" | ").slice(0, 800));
  check(errors.length === 0, `no console errors (${errors.length})`);
} finally {
  b.close();
}
