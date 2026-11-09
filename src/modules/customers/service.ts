import "server-only";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { labelDeleteBlockers, normEmail, SYSTEM_LABELS } from "./rules";

/**
 * Contacts, consents and labels (spec v2, Customers). Every function takes the session's storeId and checks that the
 * rows it touches belong to that store. Nothing here sends a message.
 */

export class CustomerError extends Error {
  constructor(
    public readonly code:
      "not_found" | "label_in_use" | "system_label" | "bad_input" | "duplicate",
    message: string,
    public readonly detail?: string[],
  ) {
    super(message);
  }
}

const db = () => serviceRoleClient();

async function own(storeId: string, table: "contacts" | "labels", id: string) {
  const { data, error } = await db()
    .from(table)
    .select("id")
    .eq("store_id", storeId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`${table} read failed: ${error.code}`);
  if (!data) throw new CustomerError("not_found", "Not found");
}

/**
 * At first capture: find the buyer by email (or create them, source `checkout`), link the order, and record an
 * order-updates consent for email. Marketing stays off: it needs an opt-in. Safe to call again.
 */
export async function contactFromCheckout(
  storeId: string,
  input: {
    orderId: string;
    email?: string;
    country?: string;
    channel?: string;
  },
): Promise<string | null> {
  const email = normEmail(input.email);
  if (!email) return null;
  const { data: found, error } = await db()
    .from("contacts")
    .select("id, merged_into")
    .eq("store_id", storeId)
    .ilike("email", email)
    .limit(5);
  if (error) throw new Error(`Contact read failed: ${error.code}`);
  const live = found?.find((c) => !c.merged_into) ?? found?.[0];
  let contactId = live ? (live.merged_into ?? live.id) : null;
  if (!contactId) {
    const { data: row, error: insertError } = await db()
      .from("contacts")
      .insert({
        store_id: storeId,
        email,
        country:
          input.country && /^[A-Z]{2}$/.test(input.country)
            ? input.country
            : null,
        source: "checkout",
      })
      .select("id")
      .single();
    if (insertError)
      throw new Error(`Contact insert failed: ${insertError.code}`);
    contactId = row.id;
  }
  const { data: consent } = await db()
    .from("contact_consents")
    .select("id")
    .eq("store_id", storeId)
    .eq("contact_id", contactId)
    .eq("channel", "email")
    .limit(1);
  if (!consent?.length) {
    const { error: cErr } = await db()
      .from("contact_consents")
      .insert({
        store_id: storeId,
        contact_id: contactId,
        channel: "email",
        marketing: false,
        source: "checkout",
      });
    if (cErr) throw new Error(`Consent insert failed: ${cErr.code}`);
  }
  const { error: oErr } = await db()
    .from("orders")
    .update({ contact_id: contactId })
    .eq("store_id", storeId)
    .eq("id", input.orderId)
    .is("contact_id", null);
  if (oErr) throw new Error(`Order link failed: ${oErr.code}`);
  return contactId;
}

// ─── labels ───

const COLOUR = /^#[0-9a-fA-F]{6}$/;

export async function createLabel(
  storeId: string,
  name: string,
  colour: string,
) {
  const clean = name.trim().slice(0, 40);
  if (!clean || !COLOUR.test(colour))
    throw new CustomerError("bad_input", "Give the label a name and a colour.");
  if ((SYSTEM_LABELS as readonly string[]).includes(clean.toLowerCase()))
    throw new CustomerError(
      "system_label",
      "That name belongs to a system label.",
    );
  const { data, error } = await db()
    .from("labels")
    .insert({ store_id: storeId, name: clean, colour, system: false })
    .select("id")
    .single();
  if (error?.code === "23505")
    throw new CustomerError(
      "duplicate",
      "A label with that name already exists.",
    );
  if (error) throw new Error(`Label insert failed: ${error.code}`);
  return data.id;
}

async function userLabel(storeId: string, labelId: string) {
  const { data, error } = await db()
    .from("labels")
    .select("id, name, system")
    .eq("store_id", storeId)
    .eq("id", labelId)
    .maybeSingle();
  if (error) throw new Error(`Label read failed: ${error.code}`);
  if (!data) throw new CustomerError("not_found", "Label not found");
  if (data.system)
    throw new CustomerError(
      "system_label",
      "System labels are computed and can't be changed.",
    );
  return data;
}

export async function updateLabel(
  storeId: string,
  labelId: string,
  patch: { name?: string; colour?: string },
) {
  await userLabel(storeId, labelId);
  const name = patch.name?.trim().slice(0, 40);
  if (patch.colour !== undefined && !COLOUR.test(patch.colour))
    throw new CustomerError("bad_input", "Pick a colour.");
  if (
    name !== undefined &&
    (!name || (SYSTEM_LABELS as readonly string[]).includes(name.toLowerCase()))
  )
    throw new CustomerError("bad_input", "Give the label another name.");
  const { error } = await db()
    .from("labels")
    .update({
      ...(name !== undefined && { name }),
      ...(patch.colour && { colour: patch.colour }),
    })
    .eq("store_id", storeId)
    .eq("id", labelId);
  if (error?.code === "23505")
    throw new CustomerError(
      "duplicate",
      "A label with that name already exists.",
    );
  if (error) throw new Error(`Label update failed: ${error.code}`);
}

/** Blocked while a scheduled campaign targets the label; the error names those campaigns. */
export async function deleteLabel(storeId: string, labelId: string) {
  await userLabel(storeId, labelId);
  const { data: campaigns, error } = await db()
    .from("campaigns")
    .select("id, name, status, segment")
    .eq("store_id", storeId)
    .eq("status", "scheduled");
  if (error) throw new Error(`Campaign read failed: ${error.code}`);
  const blockers = labelDeleteBlockers(labelId, campaigns ?? []);
  if (blockers.length)
    throw new CustomerError(
      "label_in_use",
      "A scheduled campaign uses this label.",
      blockers.map((c) => c.name),
    );
  const { error: dErr } = await db()
    .from("labels")
    .delete()
    .eq("store_id", storeId)
    .eq("id", labelId);
  if (dErr) throw new Error(`Label delete failed: ${dErr.code}`);
}

export async function setContactLabel(
  storeId: string,
  contactId: string,
  labelId: string,
  on: boolean,
) {
  await own(storeId, "contacts", contactId);
  await userLabel(storeId, labelId);
  const q = on
    ? db()
        .from("contact_labels")
        .upsert(
          { store_id: storeId, contact_id: contactId, label_id: labelId },
          { onConflict: "contact_id,label_id", ignoreDuplicates: true },
        )
    : db()
        .from("contact_labels")
        .delete()
        .eq("store_id", storeId)
        .eq("contact_id", contactId)
        .eq("label_id", labelId);
  const { error } = await q;
  if (error) throw new Error(`Contact label failed: ${error.code}`);
}

// ─── merge, export, delete ───

/** Moves `mergeId`'s orders, chats, consents, labels and sends onto `keepId`, fills blanks, and marks it merged. */
export async function mergeContacts(
  storeId: string,
  keepId: string,
  mergeId: string,
) {
  if (keepId === mergeId)
    throw new CustomerError("bad_input", "Pick two different contacts.");
  const { data: rows, error } = await db()
    .from("contacts")
    .select("id, name, email, phone, telegram_username, country, merged_into")
    .eq("store_id", storeId)
    .in("id", [keepId, mergeId]);
  if (error) throw new Error(`Contact read failed: ${error.code}`);
  const keep = rows?.find((r) => r.id === keepId);
  const drop = rows?.find((r) => r.id === mergeId);
  if (!keep || !drop || keep.merged_into || drop.merged_into)
    throw new CustomerError("not_found", "Contact not found");
  const d = db();
  for (const table of [
    "orders",
    "conversations",
    "contact_consents",
    "campaign_sends",
  ] as const) {
    const { error: e } = await d
      .from(table)
      .update({ contact_id: keepId })
      .eq("store_id", storeId)
      .eq("contact_id", mergeId);
    if (e) throw new Error(`${table} move failed: ${e.code}`);
  }
  const { data: labels } = await d
    .from("contact_labels")
    .select("label_id")
    .eq("store_id", storeId)
    .eq("contact_id", mergeId);
  if (labels?.length) {
    const { error: e } = await d.from("contact_labels").upsert(
      labels.map((l) => ({
        store_id: storeId,
        contact_id: keepId,
        label_id: l.label_id,
      })),
      { onConflict: "contact_id,label_id", ignoreDuplicates: true },
    );
    if (e) throw new Error(`Label move failed: ${e.code}`);
    await d
      .from("contact_labels")
      .delete()
      .eq("store_id", storeId)
      .eq("contact_id", mergeId);
  }
  const fill = {
    ...(!keep.name && drop.name && { name: drop.name }),
    ...(!keep.email && drop.email && { email: drop.email }),
    ...(!keep.phone && drop.phone && { phone: drop.phone }),
    ...(!keep.telegram_username &&
      drop.telegram_username && { telegram_username: drop.telegram_username }),
    ...(!keep.country && drop.country && { country: drop.country }),
  };
  if (Object.keys(fill).length)
    await d
      .from("contacts")
      .update(fill)
      .eq("store_id", storeId)
      .eq("id", keepId);
  const { error: mErr } = await d
    .from("contacts")
    .update({ merged_into: keepId })
    .eq("store_id", storeId)
    .eq("id", mergeId);
  if (mErr) throw new Error(`Merge failed: ${mErr.code}`);
}

/** Everything AxoriOS holds about one contact, for a privacy export. */
export async function exportContact(storeId: string, contactId: string) {
  await own(storeId, "contacts", contactId);
  const d = db();
  const [contact, consents, labels, orders, conversations, sends] =
    await Promise.all([
      d
        .from("contacts")
        .select(
          "id, name, email, phone, telegram_username, country, source, first_seen_at, created_at",
        )
        .eq("store_id", storeId)
        .eq("id", contactId)
        .single(),
      d
        .from("contact_consents")
        .select("channel, marketing, source, consented_at, withdrawn_at")
        .eq("store_id", storeId)
        .eq("contact_id", contactId),
      d
        .from("contact_labels")
        .select("labels(name)")
        .eq("store_id", storeId)
        .eq("contact_id", contactId),
      d
        .from("orders")
        .select(
          "id, created_at, status, currency, total_minor, items, delivery_note, buyer_country",
        )
        .eq("store_id", storeId)
        .eq("contact_id", contactId),
      d
        .from("conversations")
        .select("id, channel, customer_ref, created_at")
        .eq("store_id", storeId)
        .eq("contact_id", contactId),
      d
        .from("campaign_sends")
        .select("channel, status, sent_at")
        .eq("store_id", storeId)
        .eq("contact_id", contactId),
    ]);
  const ids = (conversations.data ?? []).map((c) => c.id);
  const messages = ids.length
    ? await d
        .from("messages")
        .select("conversation_id, role, body, created_at")
        .eq("store_id", storeId)
        .in("conversation_id", ids)
    : { data: [] };
  return {
    exportedAt: new Date().toISOString(),
    contact: contact.data,
    consents: consents.data ?? [],
    labels: (labels.data ?? [])
      .map((l) => (l.labels as unknown as { name: string } | null)?.name)
      .filter(Boolean),
    orders: orders.data ?? [],
    conversations: conversations.data ?? [],
    messages: messages.data ?? [],
    campaignSends: sends.data ?? [],
  };
}

/**
 * Deletes the contact and what identifies them: consents, labels and sends go with the row (cascade); orders and
 * chats stay for the books but lose the link, and the order's customer reference is cleared.
 */
export async function deleteContact(storeId: string, contactId: string) {
  await own(storeId, "contacts", contactId);
  const d = db();
  const { error: oErr } = await d
    .from("orders")
    .update({ customer_ref: null })
    .eq("store_id", storeId)
    .eq("contact_id", contactId);
  if (oErr) throw new Error(`Order clear failed: ${oErr.code}`);
  await d
    .from("contacts")
    .update({ merged_into: null })
    .eq("store_id", storeId)
    .eq("merged_into", contactId);
  const { error } = await d
    .from("contacts")
    .delete()
    .eq("store_id", storeId)
    .eq("id", contactId);
  if (error) throw new Error(`Contact delete failed: ${error.code}`);
}

/** Label chips for a set of contacts (Inbox threads). */
export async function labelsForContacts(
  storeId: string,
  contactIds: string[],
): Promise<Map<string, { name: string; colour: string }[]>> {
  const out = new Map<string, { name: string; colour: string }[]>();
  if (!contactIds.length) return out;
  const { data, error } = await db()
    .from("contact_labels")
    .select("contact_id, labels(name, colour, system)")
    .eq("store_id", storeId)
    .in("contact_id", contactIds);
  if (error) throw new Error(`Contact labels read failed: ${error.code}`);
  for (const row of data ?? []) {
    const l = row.labels as unknown as {
      name: string;
      colour: string;
      system: boolean;
    } | null;
    if (!l || l.system) continue;
    out.set(row.contact_id, [
      ...(out.get(row.contact_id) ?? []),
      { name: l.name, colour: l.colour },
    ]);
  }
  return out;
}

/** Contacts with a live marketing opt-in on any channel. */
export async function marketingOptIns(storeId: string): Promise<Set<string>> {
  const { data, error } = await db()
    .from("contact_consents")
    .select("contact_id")
    .eq("store_id", storeId)
    .eq("marketing", true)
    .is("withdrawn_at", null)
    .limit(10000);
  if (error) throw new Error(`Consent read failed: ${error.code}`);
  return new Set((data ?? []).map((x) => x.contact_id));
}

/** One contact's profile: consent per channel, their latest Inbox thread, and campaigns that led to their orders or messaged them. */
export async function contactProfile(storeId: string, contactId: string) {
  const d = db();
  const { data: contact, error } = await d
    .from("contacts")
    .select(
      "id, name, email, phone, telegram_username, country, source, first_seen_at, merged_into",
    )
    .eq("store_id", storeId)
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw new Error(`Contact read failed: ${error.code}`);
  if (!contact) return null;
  const [consents, thread, sends] = await Promise.all([
    d
      .from("contact_consents")
      .select("id, channel, marketing, source, consented_at, withdrawn_at")
      .eq("store_id", storeId)
      .eq("contact_id", contactId)
      .order("consented_at"),
    d
      .from("conversations")
      .select("id, channel")
      .eq("store_id", storeId)
      .eq("contact_id", contactId)
      .order("last_message_at", { ascending: false })
      .limit(1),
    d
      .from("campaign_sends")
      .select("campaign_id, status, sent_at, campaigns(name)")
      .eq("store_id", storeId)
      .eq("contact_id", contactId),
  ]);
  return {
    contact,
    consents: consents.data ?? [],
    threadId: thread.data?.[0]?.id ?? null,
    sends: (sends.data ?? []).map((s) => ({
      campaignId: s.campaign_id,
      status: s.status,
      sentAt: s.sent_at,
      name: (s.campaigns as unknown as { name: string } | null)?.name ?? "",
    })),
  };
}
