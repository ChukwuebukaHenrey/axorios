/**
 * Import row schemas (spec v2, Store › Import). Columns are mapped; values pass through Zod unchanged.
 * A missing price stays missing and the row is flagged — nothing is guessed. Pure.
 */
import { z } from "zod";

const int = z.coerce.number().int();
const minor = z.coerce.number().int().nonnegative();
const country = z.string().regex(/^[A-Z]{2}$/);
const currency = z.string().regex(/^[A-Z]{3}$/);
const when = z.iso.datetime({ offset: true });

export const ProductImportRow = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price_minor: minor, // required: a blank price is flagged, never filled in
  currency,
  stock: int.nonnegative().optional(),
  inventory_mode: z.enum(["tracked", "made_to_order", "unlimited"]).optional(),
  category: z.string().max(80).optional(),
  image_url: z.url().optional(),
});

export const ContactImportRow = z.object({
  ref: z.string().min(1).max(80), // the file's own key, used to link orders to contacts
  name: z.string().max(200).optional(),
  email: z.email().optional(),
  phone: z.string().max(40).optional(),
  telegram_username: z.string().max(64).optional(),
  country: country.optional(),
  first_seen_at: when.optional(),
  marketing_consent: z.enum(["yes", "no"]).optional(),
  consent_channel: z.string().max(20).optional(),
  labels: z.string().max(500).optional(), // ";"-separated user label names
});

/** One row per order line; lines with the same order_ref form one order. */
export const OrderImportRow = z.object({
  order_ref: z.string().min(1).max(80),
  paid_at: when,
  status: z.enum(["paid", "refunded", "partially_refunded"]).default("paid"),
  channel: z.enum(["web", "whatsapp", "telegram", "instagram", "facebook", "tiktok", "google", "shopify"]),
  contact_ref: z.string().max(80).optional(),
  product_id: z.uuid(),
  product_name: z.string().min(1).max(200),
  quantity: int.positive(),
  unit_minor: minor,
  line_minor: minor,
  currency,
  total_minor: minor,
  tax_minor: minor.default(0),
  tax_rate_bp: int.nonnegative().default(0),
  tax_inclusive: z.enum(["true", "false"]).default("true"),
  charge_currency: currency,
  charge_total_minor: minor,
  fx_rate: z.coerce.number().positive().optional(),
  fx_source: z.string().max(60).optional(),
  paypal_fee_minor: minor.optional(),
  paypal_net_minor: int.optional(),
  refunded_minor: minor.default(0),
  refunded_charge_minor: minor.default(0),
  delivery_country: country.optional(),
  buyer_country: country.optional(),
  link_code: z.string().max(24).optional(),
  fulfilled_at: when.optional(),
});

export const RefundImportRow = z.object({
  order_ref: z.string().min(1),
  amount_minor: minor.refine((n) => n > 0),
  currency,
  store_amount_minor: minor,
  vat_reversed_minor: minor.default(0),
  reason: z.string().max(200).optional(),
  created_at: when,
});

export type ProductImport = z.infer<typeof ProductImportRow>;
export type ContactImport = z.infer<typeof ContactImportRow>;
export type OrderImport = z.infer<typeof OrderImportRow>;
export type RefundImport = z.infer<typeof RefundImportRow>;

export type RowProblem = { row: number; issues: string[] };

/** Splits rows into valid and flagged. Row numbers are 1-based data rows (the header is row 0). */
export function validateRows<S extends z.ZodType>(schema: S, rows: Record<string, unknown>[]) {
  const valid: z.infer<S>[] = [];
  const problems: RowProblem[] = [];
  rows.forEach((raw, i) => {
    const parsed = schema.safeParse(raw);
    if (parsed.success) valid.push(parsed.data);
    else problems.push({ row: i + 1, issues: parsed.error.issues.map((x) => `${x.path.join(".") || "row"}: ${x.message}`) });
  });
  return { valid, problems };
}
