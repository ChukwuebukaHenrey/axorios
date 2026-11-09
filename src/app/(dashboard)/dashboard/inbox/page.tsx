import { AlertTriangle, ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/messages";
import { conversationMessages, listConversations, WHATSAPP_TEMPLATES, whatsappPausedAt } from "@/modules/channels";
import { labelsForContacts } from "@/modules/customers";
import { PageHeader } from "../../page-header";
import { requireSeller } from "../../session";
import { Conversation } from "./conversation";

export const metadata = { title: "Inbox | AxoriOS" };

const i = t.app.inbox;
const CHANNEL_LABEL: Record<string, string> = {
  web: t.dashboard.channelWeb,
  telegram: t.dashboard.channelTelegram,
  whatsapp: t.dashboard.channelWhatsApp,
  instagram: t.dashboard.channelInstagram,
};

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { store } = await requireSeller();
  const [{ c }, conversations, pausedAt] = await Promise.all([searchParams, listConversations(store.id), whatsappPausedAt(store.id)]);
  const templates = WHATSAPP_TEMPLATES.map((x) => ({ name: x.name, label: i.templates[x.previewKey] }));
  const selected = conversations.find((conv) => conv.id === c) ?? null;
  const [messages, chips] = await Promise.all([
    selected ? conversationMessages(store.id, selected.id) : Promise.resolve([]),
    labelsForContacts(store.id, [...new Set(conversations.map((x) => x.contactId).filter((x): x is string => !!x))]),
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6 lg:px-8">
      <PageHeader title={i.title} subtitle={i.subtitle} />

      {pausedAt && (
        <div role="alert" data-whatsapp-paused className="mt-4 flex gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
          <p>
            <span className="font-semibold text-cream">{i.paused}</span>
            <span className="mt-1 block text-stone">{i.pausedBody}</span>
          </p>
        </div>
      )}

      {conversations.length === 0 ? (
        <p className="mt-6 flex items-center gap-3 rounded-2xl border border-panel-3 bg-panel p-6 text-stone">
          <MessageCircle className="size-5 shrink-0" aria-hidden="true" /> {i.empty}
        </p>
      ) : (
        <div className="mt-6 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <ul className={`${selected ? "hidden lg:block" : "block"} min-h-0 overflow-y-auto rounded-2xl border border-panel-3 bg-panel p-2`}>
            {conversations.map((conv) => {
              const waiting = conv.lastMessage?.role === "customer" && conv.agentPaused;
              return (
                <li key={conv.id}>
                  <Link
                    href={`/dashboard/inbox?c=${conv.id}`}
                    aria-current={conv.id === selected?.id ? "page" : undefined}
                    className={`block rounded-xl px-3 py-3 transition ${conv.id === selected?.id ? "bg-panel-3" : "hover:bg-panel-2"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium text-cream">{conv.customerRef}</span>
                      <span className="text-xs text-stone" suppressHydrationWarning>
                        {new Date(conv.lastMessageAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-stone">{conv.lastMessage?.body ?? "—"}</span>
                    {conv.contactId && chips.get(conv.contactId)?.length ? (
                      <span aria-label={t.app.inbox.labelsLabel} data-thread-labels className="mt-1.5 flex flex-wrap gap-1">
                        {chips.get(conv.contactId)!.map((l) => (
                          <span key={l.name} className="inline-flex items-center gap-1 rounded-full border border-panel-3 px-1.5 py-0.5 text-[11px] text-cream/80">
                            <span className="size-1.5 rounded-full" style={{ background: l.colour }} aria-hidden="true" />
                            {l.name}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    <span className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-md bg-panel-2 px-2 py-0.5 text-cream/80">{CHANNEL_LABEL[conv.channel] ?? conv.channel}</span>
                      <span className={`rounded-md px-2 py-0.5 ${conv.agentPaused ? "bg-accent/15 text-accent" : "bg-lime/10 text-lime"}`}>
                        {conv.agentPaused ? i.agentOff : i.agentOn}
                      </span>
                      {waiting && <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-red-300">{i.needsReply}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <div className="flex min-h-0 flex-col">
              <Link href="/dashboard/inbox" className="mb-3 inline-flex items-center gap-2 text-sm text-stone hover:text-cream lg:hidden">
                <ArrowLeft className="size-4" aria-hidden="true" /> {i.back}
              </Link>
              <Conversation
                key={selected.id}
                conversation={{ ...selected, channelLabel: CHANNEL_LABEL[selected.channel] ?? selected.channel }}
                messages={messages}
                templates={templates}
              />
            </div>
          ) : (
            <p className="hidden items-center justify-center rounded-2xl border border-panel-3 bg-panel p-6 text-stone lg:flex">{i.pick}</p>
          )}
        </div>
      )}
    </main>
  );
}
