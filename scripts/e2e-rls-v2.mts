/**
 * 6.2 verification: the demo seller (A) can't read another seller's (B) rows in the v2 tables.
 * Writes one row per table into B's store with the service role, reads as A through RLS, then cleans up.
 * Run: npx tsx --env-file=.env.local scripts/e2e-rls-v2.mts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const seller = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const { data: auth, error: signInError } = await seller.auth.signInWithPassword({
  email: process.env.DEMO_SELLER_EMAIL!,
  password: process.env.DEMO_SELLER_PASSWORD!,
});
if (signInError) throw new Error(`sign-in failed: ${signInError.message}`);
const a = auth.user!.id;

const { data: other } = await admin.from("stores").select("id, owner_id").neq("owner_id", a).limit(1).single();
if (!other) throw new Error("need a store owned by someone else");
const b = { store: other.id, owner: other.owner_id };

const contact = (await admin.from("contacts").insert({ store_id: b.store, name: "RLS probe", source: "seed" }).select("id").single()).data!;
const label = (await admin.from("labels").insert({ store_id: b.store, name: `rls-${Date.now()}` }).select("id").single()).data!;
const inserts: [string, Record<string, unknown>][] = [
  ["contact_consents", { store_id: b.store, contact_id: contact.id, channel: "telegram", source: "seed" }],
  ["contact_labels", { store_id: b.store, contact_id: contact.id, label_id: label.id }],
  ["campaigns", { store_id: b.store, name: "rls", kind: "broadcast", source: "seed" }],
  ["promotions", { store_id: b.store, code: `RLS${Date.now()}`, kind: "percent", value: 10, starts_at: new Date().toISOString(), ends_at: new Date().toISOString(), source: "seed" }],
  ["tracked_links", { store_id: b.store, code: `rls${Date.now()}`.slice(0, 20), target: "/", source: "seed" }],
  ["store_visits", { store_id: b.store, day: "2000-01-01", visits: 1 }],
  ["expenses", { store_id: b.store, day: "2000-01-01", amount_minor: 100, currency: "USD", category: "rls", source: "seed" }],
  ["withdrawals", { owner_id: b.owner, store_id: b.store, day: "2000-01-01", usd_minor: 1, ngn_minor: 1, rate: 1, source: "seed" }],
  ["media", { owner_id: b.owner, store_id: b.store, url: "https://example.com/x.png", source: "seed" }],
  ["insights", { store_id: b.store, period: "rls", finding: "rls", source: "seed" }],
  ["activity_log", { owner_id: b.owner, store_id: b.store, actor: "system", action: "rls" }],
  ["ai_threads", { owner_id: b.owner, store_id: b.store, title: "rls" }],
];
for (const [table, row] of inserts) {
  const { error } = await admin.from(table).insert(row);
  if (error) throw new Error(`${table} insert: ${error.message}`);
}

let failures = 0;
const tables = ["contacts", "labels", ...inserts.map(([t]) => t)];
for (const table of tables) {
  const column = ["withdrawals", "media", "activity_log", "ai_threads"].includes(table) ? "owner_id" : "store_id";
  const value = column === "owner_id" ? b.owner : b.store;
  const { data, error } = await seller.from(table).select("*").eq(column, value);
  const leaked = (data ?? []).length;
  if (error || leaked > 0) failures++;
  console.log(`${leaked === 0 && !error ? "ok  " : "FAIL"} ${table}: A sees ${leaked} of B's rows${error ? ` (${error.message})` : ""}`);
}
// A can't write into B's store either.
const { error: writeError } = await seller.from("labels").insert({ store_id: b.store, name: "intruder" });
console.log(`${writeError ? "ok  " : "FAIL"} labels insert into B's store is refused`);
if (!writeError) failures++;

// Clean up B's probe rows.
for (const [table] of inserts.reverse()) {
  const column = ["withdrawals", "media", "activity_log", "ai_threads"].includes(table) ? "owner_id" : "store_id";
  const value = column === "owner_id" ? b.owner : b.store;
  let q = admin.from(table).delete().eq(column, value);
  if (table === "activity_log") q = q.eq("action", "rls");
  if (table === "ai_threads" || table === "insights") q = q.eq(table === "ai_threads" ? "title" : "period", "rls");
  if (["store_visits", "expenses", "withdrawals"].includes(table)) q = q.eq("day", "2000-01-01");
  if (table === "media") q = q.eq("source", "seed");
  if (["campaigns", "promotions", "tracked_links"].includes(table)) q = q.eq("source", "seed");
  await q;
}
await admin.from("labels").delete().eq("id", label.id);
await admin.from("contacts").delete().eq("id", contact.id);

console.log(failures === 0 ? "\nPASS: no cross-seller reads or writes" : `\nFAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
