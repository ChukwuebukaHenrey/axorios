"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseToMinor } from "@/lib/money";
import { executeRefund, getOrder, previewRefund, type RefundOutcome, type RefundPlan } from "@/modules/orders";
import { requireSeller } from "../../session";

const Input = z.object({
  orderId: z.uuid(),
  /** Partial amount in the captured currency as typed ("10.00"); empty = full refund. */
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).optional().or(z.literal("")),
});

export type RefundPreview = (RefundPlan & { storeCurrency: string; approvalId: string }) | { ok: false; reason: "invalid_amount" | "not_found"; storeCurrency?: undefined; approvalId?: undefined };

async function amountFor(storeId: string, orderId: string, amount: string | undefined) {
  if (!amount) return { order: await getOrder(storeId, orderId), minor: undefined };
  const order = await getOrder(storeId, orderId);
  return { order, minor: order ? parseToMinor(amount, order.charge_currency) : undefined };
}

/**
 * What the Refund card shows. Nothing is sent. A fresh approval id comes with every preview: approving with it
 * twice finds the same refund row, so a double click or a retry can never refund twice.
 */
export async function previewRefundAction(input: { orderId: string; amount?: string }): Promise<RefundPreview> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid_amount" };
  const { store } = await requireSeller();
  const { order, minor } = await amountFor(store.id, parsed.data.orderId, parsed.data.amount || undefined);
  if (!order) return { ok: false, reason: "not_found" };
  const plan = await previewRefund(store.id, order.id, minor);
  return { ...plan, storeCurrency: order.currency, approvalId: randomUUID() } as RefundPreview;
}

/** Runs only from the card's Approve button. The store comes from the session, never from the browser. */
export async function approveRefundAction(input: { orderId: string; amount?: string; approvalId: string; reason?: string }): Promise<RefundOutcome> {
  const parsed = Input.extend({ approvalId: z.uuid(), reason: z.string().trim().max(200).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid_amount" };
  const { store } = await requireSeller();
  const { order, minor } = await amountFor(store.id, parsed.data.orderId, parsed.data.amount || undefined);
  if (!order) return { ok: false, reason: "not_found" };
  const outcome = await executeRefund(store.id, order.id, parsed.data.approvalId, { amountMinor: minor, reason: parsed.data.reason || undefined, actor: "seller" });
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/money");
  return outcome;
}
