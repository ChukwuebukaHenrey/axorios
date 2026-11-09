import Link from "next/link";
import { connection } from "next/server";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import {
  isCounted,
  loadContacts,
  loadLabels,
  loadMetricOrders,
} from "@/modules/analytics";
import { duplicateGroups, marketingOptIns } from "@/modules/customers";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { PageHeader } from "../../page-header";
import { requireSeller } from "../../session";
import { LabelRow, MergeButton, NewLabel } from "./controls";

export const metadata = { title: "Customers | AxoriOS" };

const c = t.app.customers;
const TABS = ["contacts", "labels", "duplicates"] as const;
type Tab = (typeof TABS)[number];
const PAGE = 25;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    label?: string;
    type?: string;
    page?: string;
  }>;
}) {
  await connection();
  const { store } = await requireSeller();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "")
    ? (sp.tab as Tab)
    : "contacts";

  const [contacts, labels, orders, consents] = await Promise.all([
    loadContacts(store.id),
    loadLabels(store.id),
    loadMetricOrders(store.id),
    marketingOptIns(store.id),
  ]);
  const userLabels = labels
    .filter((l) => !l.system)
    .sort((a, b) => a.name.localeCompare(b.name));
  const labelById = new Map(labels.map((l) => [l.id, l]));
  const stats = new Map<string, { orders: number; sales: number }>();
  for (const o of orders.filter(isCounted)) {
    if (!o.contact_id) continue;
    const s = stats.get(o.contact_id) ?? { orders: 0, sales: 0 };
    s.orders += 1;
    s.sales += o.total_minor - o.refunded_minor;
    stats.set(o.contact_id, s);
  }
  const optedIn = consents;
  const live = contacts.filter((x) => !x.merged_into);
  const nameOf = (x: (typeof contacts)[number]) =>
    x.name ??
    x.email ??
    x.phone ??
    (x.telegram_username ? `@${x.telegram_username}` : "—");

  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = live
    .filter(
      (x) =>
        !q ||
        [x.name, x.email, x.phone, x.telegram_username].some((v) =>
          v?.toLowerCase().includes(q),
        ),
    )
    .filter((x) => !sp.label || x.label_ids.includes(sp.label))
    .filter((x) => !sp.type || (sp.type === "customer") === stats.has(x.id))
    .sort(
      (a, b) =>
        (stats.get(b.id)?.sales ?? 0) - (stats.get(a.id)?.sales ?? 0) ||
        (a.first_seen_at < b.first_seen_at ? 1 : -1),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const link = (p: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    const merged = {
      tab: tab === "contacts" ? undefined : tab,
      q: sp.q,
      label: sp.label,
      type: sp.type,
      page: undefined as string | undefined,
      ...p,
    };
    for (const [k, v] of Object.entries(merged)) if (v) s.set(k, v);
    const qs = s.toString();
    return `/dashboard/customers${qs ? `?${qs}` : ""}`;
  };
  const labelCount = new Map<string, number>();
  for (const x of live)
    for (const id of x.label_ids)
      labelCount.set(id, (labelCount.get(id) ?? 0) + 1);
  const groups = tab === "duplicates" ? duplicateGroups(contacts) : [];

  return (
    <main className="flex-1 overflow-y-auto px-4 pt-6 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={c.title} subtitle={c.subtitle} />
      <div className="mt-6 border-b border-panel-3 pb-4">
        <Segmented
          label={c.title}
          value={tab}
          items={TABS.map((tb) => ({ value: tb, label: c.tabs[tb], href: tb === "contacts" ? "/dashboard/customers" : `/dashboard/customers?tab=${tb}` }))}
        />
      </div>

      {tab === "contacts" && (
        <section className="mt-5 rounded-xl border border-panel-3 bg-panel p-5">
          <form
            className="flex flex-wrap items-center gap-2"
            action="/dashboard/customers"
          >
            <label className="sr-only" htmlFor="q">
              {c.search}
            </label>
            <input
              id="q"
              name="q"
              defaultValue={sp.q}
              placeholder={c.search}
              className="h-8 w-full max-w-xs rounded-md border border-panel-3 bg-panel px-3 text-sm text-cream outline-none placeholder:text-stone/80 focus-visible:border-lime/50 focus-visible:ring-2 focus-visible:ring-lime/20"
            />
            <NativeSelect
              name="label"
              defaultValue={sp.label ?? ""}
              aria-label={c.allLabels}
            >
              <option value="">{c.allLabels}</option>
              {userLabels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              name="type"
              defaultValue={sp.type ?? ""}
              aria-label={c.allTypes}
            >
              <option value="">{c.allTypes}</option>
              <option value="customer">{c.type.customer}</option>
              <option value="lead">{c.type.lead}</option>
            </NativeSelect>
            <button
              type="submit"
              className="h-8 rounded-md border border-panel-3 bg-panel-2 px-3 text-sm text-cream transition-colors hover:bg-panel-3"
            >
              {c.filter}
            </button>
            <span className="ml-auto text-sm text-stone">
              {c.count.replace("{count}", filtered.length.toLocaleString("en"))}
            </span>
          </form>

          {rows.length === 0 ? (
            <p className="mt-6 text-sm text-stone">{c.none}</p>
          ) : (
            <div className="-mx-5 mt-4 overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead>
                  <tr className="border-b border-t border-panel-3 bg-panel-2/40 text-xs text-stone">
                    {[
                      c.colName,
                      c.colLabels,
                      c.colType,
                      c.colConsent,
                      c.colOrders,
                      c.colSales,
                      c.colSeen,
                    ].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`px-5 py-2 font-medium whitespace-nowrap ${i >= 4 ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-panel-3">
                  {rows.map((x) => {
                    const st = stats.get(x.id);
                    return (
                      <tr key={x.id} data-contact={x.id} className="transition-colors hover:bg-panel-2/50">
                        <td className="px-5 py-2.5">
                          <Link
                            href={`/dashboard/customers/${x.id}`}
                            className="text-cream underline-offset-4 hover:underline"
                          >
                            {nameOf(x)}
                          </Link>
                          {x.email && x.name && (
                            <span className="block text-xs text-stone">
                              {x.email}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="flex flex-wrap gap-1">
                            {x.label_ids
                              .map((id) => labelById.get(id))
                              .filter((l) => l && !l.system)
                              .map((l) => (
                                <span
                                  key={l!.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-panel-3 px-1.5 py-0.5 text-xs whitespace-nowrap text-cream/85"
                                >
                                  <span
                                    className="size-1.5 rounded-full"
                                    style={{ background: l!.colour }}
                                    aria-hidden="true"
                                  />
                                  {l!.name}
                                </span>
                              ))}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-cream/80">
                          {st ? c.type.customer : c.type.lead}
                        </td>
                        <td className="px-5 py-2.5 text-xs whitespace-nowrap text-stone">
                          {optedIn.has(x.id) ? (
                            <span className="text-lime">{c.consentYes}</span>
                          ) : (
                            c.consentNo
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-cream/90 tabular-nums">
                          {st?.orders ?? 0}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-cream/90 tabular-nums">
                          {st ? formatMinor(st.sales, store.currency) : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right whitespace-nowrap text-stone">
                          {day(x.first_seen_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <nav
              aria-label="Pages"
              className="mt-4 flex items-center justify-between text-sm"
            >
              {page > 1 ? (
                <Link
                  href={link({ page: String(page - 1) })}
                  className="text-lime underline-offset-4 hover:underline"
                >
                  {c.prev}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-stone">
                {c.page
                  .replace("{page}", String(page))
                  .replace("{pages}", String(pages))}
              </span>
              {page < pages ? (
                <Link
                  href={link({ page: String(page + 1) })}
                  className="text-lime underline-offset-4 hover:underline"
                >
                  {c.next}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      )}

      {tab === "labels" && (
        <section className="mt-5 rounded-xl border border-panel-3 bg-panel p-5">
          <p className="mb-4 text-sm text-stone">{c.labelsNote}</p>
          <NewLabel
            t={{ name: c.labelName, colour: c.labelColour, add: c.addLabel }}
          />
          <ul className="mt-4 divide-y divide-panel-3">
            {labels
              .filter((l) => l.system)
              .map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-3 text-sm">
                  <span
                    className="size-3 rounded-full"
                    style={{ background: l.colour }}
                    aria-hidden="true"
                  />
                  <span className="text-cream">{l.name}</span>
                  <span className="rounded bg-panel-3 px-1.5 py-0.5 text-xs text-stone">
                    {c.system}
                  </span>
                </li>
              ))}
            {userLabels.map((l) => (
              <LabelRow
                key={l.id}
                label={l}
                count={labelCount.get(l.id) ?? 0}
                t={{
                  save: c.save,
                  del: c.delete,
                  used: "",
                  colour: c.labelColour,
                  confirm: c.labelConfirm,
                  cancel: c.cancel,
                  contacts: c.labelContacts,
                }}
              />
            ))}
          </ul>
        </section>
      )}

      {tab === "duplicates" && (
        <section className="mt-5 rounded-xl border border-panel-3 bg-panel p-5">
          <p className="mb-4 text-sm text-stone">{c.dupNote}</p>
          {groups.length === 0 ? (
            <p className="text-sm text-stone">{c.dupNone}</p>
          ) : (
            <ul className="divide-y divide-panel-3">
              {groups.map((g) => {
                const [keep, ...rest] = g.contacts;
                return (
                  <li key={`${g.reason}:${g.value}`} className="py-3 text-sm">
                    <p className="text-xs text-stone">
                      {c.dupReason[g.reason]}:{" "}
                      <span className="font-mono">{g.value}</span>
                    </p>
                    <p className="mt-1 text-cream">
                      <Link
                        href={`/dashboard/customers/${keep.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {nameOf(keep)}
                      </Link>{" "}
                      <span className="text-stone">
                        · {day(keep.first_seen_at)}
                      </span>
                    </p>
                    {rest.map((r) => (
                      <div
                        key={r.id}
                        className="mt-2 flex flex-wrap items-center gap-3 pl-4"
                      >
                        <Link
                          href={`/dashboard/customers/${r.id}`}
                          className="text-cream/85 underline-offset-4 hover:underline"
                        >
                          {nameOf(r)}
                        </Link>
                        <span className="text-stone">
                          {day(r.first_seen_at)}
                        </span>
                        <MergeButton
                          keepId={keep.id}
                          mergeId={r.id}
                          label={c.mergeInto.replace("{name}", nameOf(keep))}
                        />
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
