import { ArrowLeft, Download, ExternalLink, MessageSquare } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import {
  isCounted,
  loadContacts,
  loadLabels,
  loadMetricOrders,
} from "@/modules/analytics";
import { contactProfile } from "@/modules/customers";
import { PageHeader } from "../../../page-header";
import { requireSeller } from "../../../session";
import { CHANNEL_LABEL, STATUS_LABEL } from "../../orders/labels";
import { ContactLabels, DeleteContact } from "../controls";

export const metadata = { title: "Customer | AxoriOS" };

const c = t.app.customers;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-panel-3 bg-panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-cream">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { store } = await requireSeller();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [profile, labels, orders, contacts] = await Promise.all([
    contactProfile(store.id, id),
    loadLabels(store.id),
    loadMetricOrders(store.id),
    loadContacts(store.id),
  ]);
  if (!profile) notFound();
  const { contact, consents, threadId, sends } = profile;
  const mine = orders
    .filter((o) => o.contact_id === id && isCounted(o))
    .sort((a, b) => (a.paid_at! < b.paid_at! ? 1 : -1));
  const on = contacts.find((x) => x.id === id)?.label_ids ?? [];
  const userLabels = labels
    .filter((l) => !l.system)
    .sort((a, b) => a.name.localeCompare(b.name));
  const name = contact.name ?? contact.email ?? contact.phone ?? "—";
  const sales = mine.reduce((s, o) => s + o.total_minor - o.refunded_minor, 0);
  const respondedIds = new Set(mine.map((o) => o.campaign_id).filter(Boolean));
  const campaigns = [
    ...new Map(
      sends
        .filter((s) => respondedIds.has(s.campaignId))
        .map((s) => [s.campaignId, s]),
    ).values(),
  ];
  const phoneDigits = contact.phone?.replace(/\D/g, "");

  return (
    <main className="flex-1 overflow-y-auto px-4 pt-6 pb-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/customers"
        className="mt-2 inline-flex items-center gap-1 text-sm text-stone hover:text-cream"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> {c.back}
      </Link>
      <PageHeader
        title={name}
        subtitle={`${mine.length ? c.type.customer : c.type.lead} · ${mine.length} ${c.orders.toLowerCase()} · ${formatMinor(sales, store.currency)}`}
      >
        <div className="flex flex-wrap gap-2">
          {threadId ? (
            <Button asChild>
              <Link href={`/dashboard/inbox?c=${threadId}`}>
                <MessageSquare aria-hidden="true" /> {c.message}
              </Link>
            </Button>
          ) : (
            <Button disabled>
              <MessageSquare aria-hidden="true" /> {c.noThread}
            </Button>
          )}
        </div>
      </PageHeader>
      {contact.merged_into && (
        <p className="mt-3 text-sm text-amber-200">
          {c.merged}:{" "}
          <Link
            href={`/dashboard/customers/${contact.merged_into}`}
            className="underline underline-offset-4"
          >
            {contact.merged_into.slice(0, 8)}
          </Link>
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title={c.details}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {(
              [
                [c.email, contact.email],
                [c.phone, contact.phone],
                [
                  c.telegram,
                  contact.telegram_username
                    ? `@${contact.telegram_username}`
                    : null,
                ],
                [c.country, contact.country],
                [
                  c.source,
                  c.sources[contact.source as keyof typeof c.sources] ??
                    contact.source,
                ],
                [c.firstSeen, day(contact.first_seen_at)],
              ] as [string, string | null][]
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs tracking-wide text-stone uppercase">
                  {k}
                </dt>
                <dd className="mt-0.5 break-words text-cream">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {(contact.email || phoneDigits) && (
            <p className="mt-4 flex flex-wrap items-center gap-3 text-xs text-stone">
              <span>{c.external}:</span>
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex items-center gap-1 underline-offset-4 hover:text-cream hover:underline"
                >
                  {c.mail}{" "}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
              {phoneDigits && (
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:text-cream hover:underline"
                >
                  {c.whatsapp}{" "}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
            </p>
          )}
        </Panel>

        <Panel title={c.labels}>
          <ContactLabels contactId={id} labels={userLabels} on={on} />
        </Panel>

        <Panel title={c.consent}>
          {consents.length === 0 ? (
            <p className="text-sm text-stone">{c.noConsent}</p>
          ) : (
            <ul
              className="divide-y divide-panel-3 text-sm"
              data-consents={consents.length}
            >
              {consents.map((x) => (
                <li
                  key={x.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="text-cream">
                    {CHANNEL_LABEL[x.channel] ?? x.channel}
                  </span>
                  <span
                    className={
                      x.marketing && !x.withdrawn_at
                        ? "text-lime"
                        : "text-stone"
                    }
                  >
                    {c.marketing}:{" "}
                    {x.marketing && !x.withdrawn_at
                      ? c.marketingOn
                      : c.marketingOff}
                  </span>
                  <span className="basis-full text-xs text-stone">
                    {x.withdrawn_at
                      ? c.withdrawn.replace("{date}", day(x.withdrawn_at))
                      : c.since
                          .replace("{date}", day(x.consented_at))
                          .replace(
                            "{source}",
                            c.sources[x.source as keyof typeof c.sources] ??
                              x.source,
                          )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={c.campaigns}>
          {campaigns.length === 0 ? (
            <p className="text-sm text-stone">{c.noCampaigns}</p>
          ) : (
            <ul className="space-y-1 text-sm text-cream">
              {campaigns.map((s) => (
                <li key={s.campaignId}>{s.name}</li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="lg:col-span-2">
          <Panel title={c.orders}>
            {mine.length === 0 ? (
              <p className="text-sm text-stone">{c.noOrders}</p>
            ) : (
              <ul className="divide-y divide-panel-3 text-sm">
                {mine.slice(0, 20).map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <Link
                      href={`/dashboard/orders/${o.id}`}
                      className="font-mono text-cream underline-offset-4 hover:underline"
                    >
                      {o.id.slice(0, 8).toUpperCase()}
                    </Link>
                    <span className="text-stone">
                      {day(o.paid_at!)} ·{" "}
                      {CHANNEL_LABEL[o.channel] ?? o.channel} ·{" "}
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    <span className="font-mono text-cream/90 tabular-nums">
                      {formatMinor(
                        o.total_minor - o.refunded_minor,
                        o.currency,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-2">
          <Panel title={c.privacy}>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={`/dashboard/customers/${id}/export`} download>
                  <Download aria-hidden="true" /> {c.export}
                </a>
              </Button>
              <DeleteContact
                contactId={id}
                t={{
                  del: c.deleteContact,
                  confirm: c.deleteConfirm,
                  cancel: c.cancel,
                }}
              />
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
