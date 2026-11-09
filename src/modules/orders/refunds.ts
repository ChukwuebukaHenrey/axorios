import "server-only";
import { createHash } from "node:crypto";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { paymentProvider, RefundError } from "@/modules/payments";
import { planRefund, REFUND_WINDOW_DAYS, type RefundPlan } from "./refund-plan";

export { REFUND_WINDOW_DAYS };
export type { RefundPlan };

/**
 * One refund row per approval: the row id is derived from (order, approval), so pressing Approve twice — or a job
 * retry — finds the same row and never sends a second refund. The row id is also PayPal-Request-Id.
 */
export function refundRowId(orderId: string, approvalId: string): string {
  const h = createHash("sha256").update(`refund:${orderId}:${approvalId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function loadOrder(storeId: string, orderId: string) {
  const { data, error } = await serviceRoleClient()
    .from("orders")
    .select("id, store_id, status, source, currency, total_minor, tax_minor, charge_currency, charge_total_minor, fx_rate, paypal_capture_id, paid_at, refunded_minor, refunded_charge_minor")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(`Order read failed: ${error.code}`);
  return data;
}

async function chargeBalance(currency: string): Promise<number | null> {
  try {
    const balances = await paymentProvider().balances();
    return balances.find((b) => b.currency === currency)?.availableMinor ?? 0;
  } catch {
    return null; // unknown: the card says so rather than blocking
  }
}

/** What the approval card shows. Nothing is sent. `amountMinor` is in the captured currency; omit for a full refund. */
export async function previewRefund(storeId: string, orderId: string, amountMinor?: number): Promise<RefundPlan> {
  const order = await loadOrder(storeId, orderId);
  if (!order) return { ok: false, reason: "not_found" };
  const plan = planRefund(order, amountMinor, new Date());
  if (!plan.ok) return plan;
  const balance = await chargeBalance(plan.currency);
  return { ...plan, balanceMinor: balance, shortfallMinor: balance === null ? null : Math.max(0, plan.amountMinor - balance) };
}

export type RefundOutcome =
  | { ok: true; refundId: string; status: "completed" | "pending" | "failed"; amountMinor: number; currency: string; storeAmountMinor: number; repeated: boolean }
  | { ok: false; reason: string };

/** Runs only after the seller approves the card. Safe to call again with the same approvalId. */
export async function executeRefund(
  storeId: string,
  orderId: string,
  approvalId: string,
  opts: { amountMinor?: number; reason?: string; actor?: "seller" | "axori_ai" } = {},
): Promise<RefundOutcome> {
  const db = serviceRoleClient();
  const id = refundRowId(orderId, approvalId);

  const { data: existing } = await db.from("refunds").select("id, status, amount_minor, currency, store_amount_minor, paypal_refund_id").eq("id", id).maybeSingle();
  if (existing && existing.paypal_refund_id) {
    return { ok: true, refundId: id, status: existing.status === "completed" ? "completed" : existing.status === "failed" ? "failed" : "pending", amountMinor: existing.amount_minor, currency: existing.currency, storeAmountMinor: existing.store_amount_minor, repeated: true };
  }

  const order = await loadOrder(storeId, orderId);
  if (!order) return { ok: false, reason: "not_found" };
  // A repeat after a crash between our insert and PayPal's answer re-sends with the same PayPal-Request-Id; PayPal dedupes it.
  const plan = existing
    ? { ok: true as const, amountMinor: existing.amount_minor, currency: existing.currency, storeAmountMinor: existing.store_amount_minor, vatReversedMinor: 0, full: false }
    : planRefund(order, opts.amountMinor, new Date());
  if (!plan.ok) return { ok: false, reason: plan.reason };

  if (!existing) {
    const { error } = await db.from("refunds").insert({
      id,
      store_id: storeId,
      order_id: orderId,
      amount_minor: plan.amountMinor,
      currency: plan.currency,
      store_amount_minor: plan.storeAmountMinor,
      vat_reversed_minor: plan.vatReversedMinor,
      status: "requested",
      reason: opts.reason ?? null,
      requested_by: opts.actor ?? "seller",
    });
    if (error?.code === "23505") return executeRefund(storeId, orderId, approvalId, opts);
    if (error) throw new Error(`Refund save failed: ${error.code}`);
  }

  let result;
  try {
    result = await paymentProvider().refund({
      captureId: order.paypal_capture_id!,
      amountMinor: plan.full ? undefined : plan.amountMinor,
      currency: plan.currency,
      requestId: id,
      note: opts.reason,
    });
  } catch (error) {
    if (error instanceof RefundError) {
      await db.from("refunds").update({ status: "failed" }).eq("id", id);
      return { ok: false, reason: error.code };
    }
    throw error;
  }

  await db
    .from("refunds")
    .update({
      paypal_refund_id: result.refundId,
      status: result.status === "completed" ? "completed" : result.status === "pending" ? "pending" : "failed",
      fee_returned_minor: result.feeReturnedMinor ?? null,
      completed_at: result.status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (result.status !== "failed") await applyToOrder(storeId, orderId, plan.amountMinor, plan.storeAmountMinor);
  await db.from("activity_log").insert({
    owner_id: (await db.from("stores").select("owner_id").eq("id", storeId).single()).data!.owner_id,
    store_id: storeId,
    actor: opts.actor ?? "seller",
    action: "refund",
    target: orderId,
    approval_id: approvalId,
    details: { refundId: id, paypalRefundId: result.refundId, amountMinor: plan.amountMinor, currency: plan.currency, status: result.status },
  });
  return { ok: true, refundId: id, status: result.status, amountMinor: plan.amountMinor, currency: plan.currency, storeAmountMinor: plan.storeAmountMinor, repeated: false };
}

/** Adds a refund to the order's running totals. Optimistic: retries if another refund landed in between. */
async function applyToOrder(storeId: string, orderId: string, chargeMinor: number, storeMinor: number) {
  const db = serviceRoleClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const o = await loadOrder(storeId, orderId);
    if (!o) return;
    const refundedCharge = Math.min(o.charge_total_minor, o.refunded_charge_minor + chargeMinor);
    const refunded = Math.min(o.total_minor, o.refunded_minor + storeMinor);
    const { data } = await db
      .from("orders")
      .update({
        refunded_charge_minor: refundedCharge,
        refunded_minor: refunded,
        status: refundedCharge >= o.charge_total_minor ? "refunded" : "partially_refunded",
      })
      .eq("id", orderId)
      .eq("store_id", storeId)
      .eq("refunded_charge_minor", o.refunded_charge_minor)
      .select("id");
    if (data && data.length > 0) return;
  }
  throw new Error(`Refund totals update kept conflicting on order ${orderId}`);
}

/**
 * PAYMENT.CAPTURE.REFUNDED from the webhook job. Confirms our pending row; a refund made outside AxoriOS
 * (PayPal dashboard) is recorded once, keyed by PayPal's refund id. Replays change nothing.
 */
export async function confirmRefundFromProvider(event: { refundId: string; captureId: string | null; amountMinor: number; currency: string; status: string }) {
  const db = serviceRoleClient();
  const { data: known } = await db.from("refunds").select("id, status").eq("paypal_refund_id", event.refundId).maybeSingle();
  if (known) {
    if (known.status !== "completed" && event.status === "COMPLETED") {
      await db.from("refunds").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", known.id);
    }
    return "confirmed";
  }
  if (!event.captureId) return "unknown_capture";
  const { data: order } = await db.from("orders").select("id, store_id").eq("paypal_capture_id", event.captureId).maybeSingle();
  if (!order) return "unknown_capture";
  const full = await loadOrder(order.store_id, order.id);
  if (!full) return "unknown_capture";
  const plan = planRefund(full, event.amountMinor, new Date(), { ignoreWindow: true });
  if (!plan.ok) return plan.reason;
  const { error } = await db.from("refunds").insert({
    id: refundRowId(order.id, `paypal:${event.refundId}`),
    store_id: order.store_id,
    order_id: order.id,
    paypal_refund_id: event.refundId,
    amount_minor: plan.amountMinor,
    currency: plan.currency,
    store_amount_minor: plan.storeAmountMinor,
    vat_reversed_minor: plan.vatReversedMinor,
    status: event.status === "COMPLETED" ? "completed" : "pending",
    reason: "Refunded in PayPal",
    requested_by: "system",
    completed_at: event.status === "COMPLETED" ? new Date().toISOString() : null,
  });
  if (error?.code === "23505") return "confirmed";
  if (error) throw new Error(`Refund save failed: ${error.code}`);
  await applyToOrder(order.store_id, order.id, plan.amountMinor, plan.storeAmountMinor);
  return "recorded";
}
