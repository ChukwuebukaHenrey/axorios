import { AlertTriangle, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Segmented } from "@/components/ui/segmented";
import { t } from "@/lib/messages";
import { conversationMessages, listConversations, WHATSAPP_TEMPLATES, whatsappPausedAt, type InboxConversation } from "@/modules/channels";
import { labelsForContacts } from "@/modules/customers";
import { EmptyState, PageHeader } from "../../page-header";
import { requireSeller } from "../../session";
import { Avatar } from "./avatar";
import { Conversation } from "./conversation";

export const metadata = { title: "Inbox | AxoriOS" };

const i = t.app.inbox;
const FILTERS = ["all", "waiting", "agent", "mine"] as const;
type Filter = (typeof FILTERS)[number];
const CHANNEL_LABEL: Record<string, string> = {
  web: t.dashboard.channelWeb,
  telegram: t.dashboard.channelTelegram,
  whatsapp: t.dashboard.channelWhatsApp,
  instagram: t.dashboard.channelInstagram,
};

const isWaiting = (c: InboxConversation) => c.lastMessage?.role === "customer" && c.agentPaused;
const MATCH: Record<Filter, (c: InboxConversation) => boolean> = {
  all: () => true,
  waiting: isWaiting,
  agent: (c) => !c.agentPaused,
  mine: (c) => c.agentPaused,
};

/** Time for today's chats, the date otherwise. */
function shortWhen(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string; f?: string }> }) {
  const { store } = await requireSeller();
  const [sp, conversations, pausedAt] = await Promise.all([searchParams, listConversations(store.id), whatsappPausedAt(store.id)]);
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.f ?? "") ? (sp.f as Filter) : "all";
  const templates = WHATSAPP_TEMPLATES.map((x) => ({ name: x.name, label: i.templates[x.previewKey] }));
  const selected = conversations.find((conv) => conv.id === sp.c) ?? null;
  const shown = conversations.filter(MATCH[filter]);
  const [messages, chips] = await Promise.all([
    selected ? conversationMessages(store.id, selected.id) : Promise.resolve([]),
    labelsForContacts(store.id, [...new Set(conversations.map((x) => x.contactId).filter((x): x is string => !!x))]),
  ]);
  const href = (p: { c?: string; f?: Filter }) => {
    const q = new URLSearchParams();
    const f = p.f ?? filter;
    if (f !== "all") q.set("f", f);
    if (p.c) q.set("c", p.c);
    const qs = q.toString();
    return `/dashboard/inbox${qs ? `?${qs}` : ""}`;
  };
  const selectedLabels = selected?.contactId ? (chips.get(selected.contactId) ?? []) : [];

  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 pt-6 pb-4 sm:px-6 lg:px-8">
      {pausedAt && (
        <div role="alert" data-whatsapp-paused className="mb-4 flex gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
          <p>
            <span className="font-semibold text-cream">{i.paused}</span>
            <span className="mt-1 block text-stone">{i.pausedBody}</span>
          </p>
        </div>
      )}

      {conversations.length === 0 ? (
        <>
          <PageHeader title={i.title} subtitle={i.subtitle} />
          <div className="mt-6">
            <EmptyState icon={<MessageCircle />} title={i.empty} />
          </div>
        </>
      ) : (
        <div className="grid min-h-[520px] flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border border-panel-3 bg-panel lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_272px]">
          {/* Chat list */}
          <aside className={`${selected ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-panel-3 lg:border-r`}>
            <div className="border-b border-panel-3 px-4 pt-3.5 pb-3">
              <div className="flex items-baseline justify-between gap-2">
                <h1 className="text-sm font-semibold text-cream">{i.title}</h1>
                <span className="font-mono text-xs text-stone tabular-nums">{conversations.length}</span>
              </div>
              <Segmented
                size="sm"
                label={i.filterLabel}
                value={filter}
                className="mt-3 w-full [&>*]:flex-1"
                items={FILTERS.map((f) => ({ value: f, label: i.filters[f], href: href({ f, c: selected?.id }), count: f === "waiting" ? conversations.filter(isWaiting).length : undefined }))}
              />
            </div>
            {shown.length === 0 ? (
              <p className="px-4 py-6 text-sm text-stone">{i.noneInFilter}</p>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {shown.map((conv) => {
                  const on = conv.id === selected?.id;
                  return (
                    <li key={conv.id} className="border-b border-panel-3/70">
                      <Link
                        href={href({ c: conv.id })}
                        aria-current={on ? "page" : undefined}
                        className={`relative flex gap-3 px-4 py-3 transition-colors ${on ? "bg-panel-2" : "hover:bg-panel-2/50"}`}
                      >
                        {on && <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-lime" aria-hidden="true" />}
                        <Avatar name={conv.customerRef} channel={conv.channel} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-cream">{conv.customerRef}</span>
                            <span className="shrink-0 text-xs text-stone tabular-nums" suppressHydrationWarning>
                              {shortWhen(conv.lastMessageAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-sm text-stone">{conv.lastMessage?.body ?? "—"}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]">
                            <span className={`rounded px-1.5 py-0.5 ${conv.agentPaused ? "bg-accent/15 text-accent" : "bg-lime/10 text-lime"}`}>{conv.agentPaused ? i.agentOff : i.agentOn}</span>
                            {isWaiting(conv) && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-300">{i.needsReply}</span>}
                            {conv.contactId && chips.get(conv.contactId)?.length ? (
                              <span aria-label={i.labelsLabel} data-thread-labels className="contents">
                                {chips.get(conv.contactId)!.map((l) => (
                                  <span key={l.name} className="inline-flex items-center gap-1 rounded border border-panel-3 px-1.5 py-0.5 text-cream/80">
                                    <span className="size-1.5 rounded-full" style={{ background: l.colour }} aria-hidden="true" />
                                    {l.name}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Thread */}
          {selected ? (
            <Conversation
              key={selected.id}
              backHref={href({})}
              conversation={{ ...selected, channelLabel: CHANNEL_LABEL[selected.channel] ?? selected.channel }}
              messages={messages}
              templates={templates}
            />
          ) : (
            <div className="hidden flex-col items-center justify-center gap-3 p-6 text-center lg:flex">
              <span className="grid size-10 place-items-center rounded-lg border border-panel-3 bg-panel-2 text-stone">
                <MessageCircle className="size-4" aria-hidden="true" />
              </span>
              <p className="text-sm text-stone">{i.pick}</p>
              <p className="max-w-xs text-xs text-stone/80">{i.subtitle}</p>
            </div>
          )}

          {/* Contact details */}
          <aside className="hidden min-h-0 flex-col overflow-y-auto border-l border-panel-3 xl:flex">
            {selected ? (
              <>
                <div className="flex flex-col items-center border-b border-panel-3 px-5 py-5 text-center">
                  <Avatar name={selected.customerRef} channel={selected.channel} />
                  <p className="mt-2 max-w-full truncate text-sm font-medium text-cream">{selected.customerRef}</p>
                  <p className="text-xs text-stone">{CHANNEL_LABEL[selected.channel] ?? selected.channel}</p>
                </div>
                <dl className="divide-y divide-panel-3/70 text-sm">
                  {(
                    [
                      [i.dChannel, CHANNEL_LABEL[selected.channel] ?? selected.channel],
                      [i.dHandled, selected.agentPaused ? i.agentOff : i.agentOn],
                      [i.dLast, <span key="w" suppressHydrationWarning>{new Date(selected.lastMessageAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="px-5 py-2.5">
                      <dt className="text-xs text-stone">{k}</dt>
                      <dd className="mt-0.5 text-cream/90">{v}</dd>
                    </div>
                  ))}
                  <div className="px-5 py-2.5">
                    <dt className="text-xs text-stone">{i.dLabels}</dt>
                    <dd className="mt-1 flex flex-wrap gap-1">
                      {selectedLabels.length ? (
                        selectedLabels.map((l) => (
                          <span key={l.name} className="inline-flex items-center gap-1 rounded border border-panel-3 px-1.5 py-0.5 text-xs text-cream/85">
                            <span className="size-1.5 rounded-full" style={{ background: l.colour }} aria-hidden="true" />
                            {l.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-stone/80">{i.dNoLabels}</span>
                      )}
                    </dd>
                  </div>
                </dl>
                {selected.contactId && (
                  <div className="mt-auto border-t border-panel-3 p-4">
                    <Link
                      href={`/dashboard/customers/${selected.contactId}`}
                      className="flex h-8 w-full items-center justify-center rounded-md border border-panel-3 bg-panel-2 text-sm text-cream transition-colors hover:bg-panel-3"
                    >
                      {i.openCustomer}
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <p className="p-5 text-sm text-stone">{i.details}</p>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
