import "server-only";
import type { Json } from "@/lib/database.types";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { csvToRecords } from "./csv";
import {
  ContactImportRow,
  OrderImportRow,
  ProductImportRow,
  RefundImportRow,
  validateRows,
  type ContactImport,
  type OrderImport,
  type RefundImport,
  type RowProblem,
} from "./schema";

export type ImportSource = "import" | "seed";
const BATCH = 500;

export class ImportError extends Error {}

async function inBatches<T>(rows: T[], write: (batch: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += BATCH) await write(rows.slice(i, i + BATCH));
}

/** Preview for the approval card: counts and flagged rows, nothing written. */
export function previewCsv(kind: "products" | "contacts" | "orders", csv: string) {
  const schema = kind === "products" ? ProductImportRow : kind === "contacts" ? ContactImportRow : OrderImportRow;
  const records = csvToRecords(csv);
  const { valid, problems } = validateRows(schema, records);
  return { total: records.length, valid: valid.length, problems: problems.slice(0, 50), sample: valid.slice(0, 10) };
}

/** Products from a file. Prices are taken as given; a row without one is flagged and skipped. */
export async function importProducts(storeId: string, csv: string, source: ImportSource = "import") {
  const { valid, problems } = validateRows(ProductImportRow, csvToRecords(csv));
  const db = serviceRoleClient();
  const { data: store } = await db.from("stores").select("currency").eq("id", storeId).single();
  const accepted = valid.filter((p, i) => {
    if (store?.currency && p.currency !== store.currency) {
      problems.push({ row: i + 1, issues: [`currency: store prices in ${store.currency}`] });
      return false;
    }
    return true;
  });
  await inBatches(accepted, async (batch) => {
    const { error } = await db.from("products").insert(
      batch.map((p) => ({
        store_id: storeId,
        name: p.name,
        description: p.description ?? "",
        price_minor: p.price_minor,
        currency: p.currency,
        stock: p.stock ?? 0,
        inventory_mode: p.inventory_mode ?? "tracked",
        category: p.category ?? null,
        image_url: p.image_url ?? null,
        source,
      })),
    );
    if (error) throw new ImportError(`products insert: ${error.code}`);
  });
  return { imported: accepted.length, problems };
}

/** Contacts, their consent and user labels. Returns the file's ref → contact id. */
export async function importContacts(storeId: string, rows: ContactImport[], source: ImportSource = "import") {
  const db = serviceRoleClient();
  const ids = new Map<string, string>();
  await inBatches(rows, async (batch) => {
    const { data, error } = await db
      .from("contacts")
      .insert(
        batch.map((c) => ({
          store_id: storeId,
          name: c.name ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          telegram_username: c.telegram_username ?? null,
          country: c.country ?? null,
          source,
          first_seen_at: c.first_seen_at ?? new Date().toISOString(),
        })),
      )
      .select("id");
    if (error) throw new ImportError(`contacts insert: ${error.code}`);
    batch.forEach((c, i) => ids.set(c.ref, data[i].id));
  });

  const consents = rows
    .filter((c) => c.consent_channel)
    .map((c) => ({
      store_id: storeId,
      contact_id: ids.get(c.ref)!,
      channel: c.consent_channel!,
      marketing: c.marketing_consent === "yes",
      source,
      consented_at: c.first_seen_at ?? new Date().toISOString(),
    }));
  await inBatches(consents, async (batch) => {
    const { error } = await db.from("contact_consents").insert(batch);
    if (error) throw new ImportError(`consents insert: ${error.code}`);
  });

  const names = [...new Set(rows.flatMap((c) => (c.labels ? c.labels.split(";").map((l) => l.trim()).filter(Boolean) : [])))];
  if (names.length > 0) {
    const { error } = await db
      .from("labels")
      .upsert(names.map((name) => ({ store_id: storeId, name })), { onConflict: "store_id,name", ignoreDuplicates: true });
    if (error) throw new ImportError(`labels upsert: ${error.code}`);
    const { data: labels } = await db.from("labels").select("id, name").eq("store_id", storeId).in("name", names);
    const byName = new Map((labels ?? []).map((l) => [l.name, l.id]));
    const links = rows.flatMap((c) =>
      (c.labels ?? "")
        .split(";")
        .map((l) => l.trim())
        .filter((l) => byName.has(l))
        .map((l) => ({ store_id: storeId, contact_id: ids.get(c.ref)!, label_id: byName.get(l)! })),
    );
    await inBatches(links, async (batch) => {
      const { error: e } = await db.from("contact_labels").insert(batch);
      if (e) throw new ImportError(`contact labels insert: ${e.code}`);
    });
  }
  return ids;
}

/**
 * Orders from line rows. Every product must belong to this store; totals must equal the sum of lines
 * and VAT can't exceed the total. A failing order is flagged whole, never partly written.
 */
export async function importOrders(
  storeId: string,
  rows: OrderImport[],
  contactIds: Map<string, string>,
  source: ImportSource = "import",
): Promise<{ ids: Map<string, string>; problems: RowProblem[] }> {
  const db = serviceRoleClient();
  const { data: products, error: pe } = await db.from("products").select("id").eq("store_id", storeId);
  if (pe) throw new ImportError(`products read: ${pe.code}`);
  const owned = new Set(products.map((p) => p.id));
  const { data: links } = await db.from("tracked_links").select("id, code").eq("store_id", storeId);
  const linkIds = new Map((links ?? []).map((l) => [l.code, l.id]));

  const groups = new Map<string, OrderImport[]>();
  for (const r of rows) groups.set(r.order_ref, [...(groups.get(r.order_ref) ?? []), r]);

  const problems: RowProblem[] = [];
  const inserts: { ref: string; row: Record<string, unknown> }[] = [];
  let rowNo = 0;
  for (const [ref, lines] of groups) {
    rowNo += lines.length;
    const head = lines[0];
    const issues: string[] = [];
    if (lines.some((l) => !owned.has(l.product_id))) issues.push("product_id: not a product of this store");
    const sum = lines.reduce((s, l) => s + l.line_minor, 0);
    if (sum !== head.total_minor) issues.push(`total_minor: ${head.total_minor} ≠ lines ${sum}`);
    if (head.tax_minor > head.total_minor) issues.push("tax_minor: more than the total");
    if (head.refunded_minor > head.total_minor) issues.push("refunded_minor: more than the total");
    if (issues.length > 0) {
      problems.push({ row: rowNo, issues: [`order ${ref}`, ...issues] });
      continue;
    }
    inserts.push({
      ref,
      row: {
        store_id: storeId,
        items: lines.map((l) => ({
          productId: l.product_id,
          name: l.product_name,
          quantity: l.quantity,
          unitMinor: l.unit_minor,
          lineMinor: l.line_minor,
        })) as unknown as Json,
        total_minor: head.total_minor,
        currency: head.currency,
        charge_total_minor: head.charge_total_minor,
        charge_currency: head.charge_currency,
        fx_rate: head.fx_rate ?? null,
        fx_source: head.fx_source ?? null,
        status: head.status,
        channel: head.channel,
        contact_id: head.contact_ref ? (contactIds.get(head.contact_ref) ?? null) : null,
        customer_ref: head.contact_ref ?? null,
        paid_at: head.paid_at,
        created_at: head.paid_at,
        tax_minor: head.tax_minor,
        tax_rate_bp: head.tax_rate_bp,
        tax_inclusive: head.tax_inclusive === "true",
        paypal_fee_minor: head.paypal_fee_minor ?? null,
        paypal_net_minor: head.paypal_net_minor ?? null,
        refunded_minor: head.refunded_minor,
        refunded_charge_minor: head.refunded_charge_minor,
        delivery_country: head.delivery_country ?? null,
        buyer_country: head.buyer_country ?? null,
        link_id: head.link_code ? (linkIds.get(head.link_code) ?? null) : null,
        fulfilled_at: head.fulfilled_at ?? null,
        source,
      },
    });
  }

  const ids = new Map<string, string>();
  await inBatches(inserts, async (batch) => {
    const { data, error } = await db
      .from("orders")
      .insert(batch.map((b) => b.row) as never)
      .select("id");
    if (error) throw new ImportError(`orders insert: ${error.code} ${error.message}`);
    batch.forEach((b, i) => ids.set(b.ref, data[i].id));
  });
  return { ids, problems };
}

/** Historic refunds for imported orders: recorded as completed, never sent to PayPal. */
export async function importRefunds(storeId: string, rows: RefundImport[], orderIds: Map<string, string>, source: ImportSource = "import") {
  const db = serviceRoleClient();
  const valid = rows.filter((r) => orderIds.has(r.order_ref));
  await inBatches(valid, async (batch) => {
    const { error } = await db.from("refunds").insert(
      batch.map((r) => ({
        store_id: storeId,
        order_id: orderIds.get(r.order_ref)!,
        amount_minor: r.amount_minor,
        currency: r.currency,
        store_amount_minor: r.store_amount_minor,
        vat_reversed_minor: r.vat_reversed_minor,
        status: "completed",
        reason: r.reason ?? null,
        requested_by: "seller",
        source,
        created_at: r.created_at,
        completed_at: r.created_at,
      })),
    );
    if (error) throw new ImportError(`refunds insert: ${error.code}`);
  });
  return valid.length;
}

/** File-level entry points: parse, validate, then write. */
export async function importContactsCsv(storeId: string, csv: string, source: ImportSource = "import") {
  const { valid, problems } = validateRows(ContactImportRow, csvToRecords(csv));
  return { ids: await importContacts(storeId, valid, source), problems };
}

export async function importOrdersCsv(storeId: string, csv: string, contactIds: Map<string, string>, source: ImportSource = "import") {
  const { valid, problems } = validateRows(OrderImportRow, csvToRecords(csv));
  const result = await importOrders(storeId, valid, contactIds, source);
  return { ids: result.ids, problems: [...problems, ...result.problems] };
}

export async function importRefundsCsv(storeId: string, csv: string, orderIds: Map<string, string>, source: ImportSource = "import") {
  const { valid, problems } = validateRows(RefundImportRow, csvToRecords(csv));
  return { imported: await importRefunds(storeId, valid, orderIds, source), problems };
}
