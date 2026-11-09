/**
 * 6.7 verification against the PayPal sandbox: a real partial and full refund on two of the hidden test orders,
 * a repeat approval sending nothing, an over-large partial refused, another store refused, and a webhook replay.
 * Run: npx tsx --import ./scripts/no-server-only.mjs --env-file=.env.local scripts/e2e-refund.mts
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { confirmRefundFromProvider, executeRefund, previewRefund } from "../src/modules/orders/refunds";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: stores } = await admin.from("stores").select("id, slug").in("slug", ["demo", "eko-sweet-kitchen-uk"]);
const demo = stores!.find((s) => s.slug === "demo")!.id;
const uk = stores!.find((s) => s.slug === "eko-sweet-kitchen-uk")!.id;
const { data: candidates } = await admin
  .from("orders")
  .select("id, status, charge_total_minor, charge_currency, refunded_charge_minor, paypal_capture_id")
  .eq("store_id", demo)
  .eq("source", "test")
  .eq("status", "paid")
  .not("paypal_capture_id", "is", null)
  .order("created_at");
if (!candidates || candidates.length < 2) throw new Error("need two paid test orders with captures");
const [partialOrder, fullOrder] = candidates;

let failures = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
};
const refundCount = async (orderId: string) => (await admin.from("refunds").select("*", { count: "exact", head: true }).eq("order_id", orderId)).count ?? 0;

const preview = await previewRefund(demo, partialOrder.id, 1000);
console.log("card:", JSON.stringify(preview));
check(preview.ok, "preview shows amounts, VAT to reverse and PayPal balance");

const approval = randomUUID();
const first = await executeRefund(demo, partialOrder.id, approval, { amountMinor: 1000, reason: "6.7 e2e partial" });
console.log("first:", JSON.stringify(first));
check(first.ok && !first.repeated && first.status !== "failed", "partial $10.00 refunded in sandbox");
const again = await executeRefund(demo, partialOrder.id, approval, { amountMinor: 1000 });
check(again.ok && again.repeated === true, "second approval of the same refund sends nothing");
check((await refundCount(partialOrder.id)) === 1, "one refund row");
const { data: after } = await admin.from("orders").select("status, refunded_charge_minor, refunded_minor").eq("id", partialOrder.id).single();
check(after!.status === "partially_refunded" && after!.refunded_charge_minor === 1000, `order now partially_refunded, ${after!.refunded_charge_minor} cents back`);

const tooBig = await previewRefund(demo, partialOrder.id, partialOrder.charge_total_minor);
check(!tooBig.ok && tooBig.reason === "exceeds_remaining", "partial larger than what's left is refused");
const otherStore = await executeRefund(uk, fullOrder.id, randomUUID());
check(!otherStore.ok && otherStore.reason === "not_found", "another store can't refund this order");

const full = await executeRefund(demo, fullOrder.id, randomUUID(), { reason: "6.7 e2e full" });
console.log("full:", JSON.stringify(full));
const { data: fullAfter } = await admin.from("orders").select("status, refunded_minor, total_minor").eq("id", fullOrder.id).single();
check(full.ok && fullAfter!.status === "refunded" && fullAfter!.refunded_minor === fullAfter!.total_minor, "full refund closes the order");

const { data: row } = await admin.from("refunds").select("paypal_refund_id").eq("order_id", partialOrder.id).single();
const replay = await confirmRefundFromProvider({ refundId: row!.paypal_refund_id!, captureId: partialOrder.paypal_capture_id, amountMinor: 1000, currency: "USD", status: "COMPLETED" });
check(replay === "confirmed" && (await refundCount(partialOrder.id)) === 1, "webhook replay changes nothing");

console.log(failures === 0 ? "\nPASS" : `\nFAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
