"use server";

import { z } from "zod";
import { MAX_ORDERS_PER_EXPORT, previewOrderExport, type ExportPreview } from "@/modules/connections";
import { requireSeller } from "../session";

const Input = z.object({
  orderIds: z.array(z.uuid()).min(1).max(MAX_ORDERS_PER_EXPORT).optional(),
  count: z.number().int().min(1).max(MAX_ORDERS_PER_EXPORT).optional(),
});

/** What the Zapier card shows before Approve. Sends nothing. The store comes from the session, never the browser. */
export async function previewZapierExportAction(input: unknown): Promise<ExportPreview> {
  const parsed = Input.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "zapier_failed" };
  const { store } = await requireSeller();
  return previewOrderExport(store.id, parsed.data);
}
