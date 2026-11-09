"use client";

import { ArrowLeft, Bot, Clock, Hand, Loader2, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { t } from "@/lib/messages";
import type { InboxConversation, InboxMessage, ReplyResult } from "@/modules/channels";
import { sendReply, sendTemplate, setTakeover } from "./actions";
import { Avatar } from "./avatar";

const i = t.app.inbox;
const ROLE_LABEL = { customer: i.customer, agent: i.agent, seller: i.seller } as const;
const FAILURE = { credits: i.paused, window: i.windowFailed, failed: i.sendFailed } as const;

/** "23 h 05 m" until the window closes. */
function formatLeft(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} h ${String(minutes % 60).padStart(2, "0")} m` : `${minutes} m`;
}

/** "Today", "Yesterday" or the date, for the separators between days. */
function dayLabel(iso: string): string {
  const d = new Date(iso).toDateString();
  if (d === new Date().toDateString()) return i.today;
  if (d === new Date(Date.now() - 86_400_000).toDateString()) return i.yesterday;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Milliseconds left in WhatsApp's reply window, ticking every 30 s. Null off WhatsApp. */
function useWindowLeft(endsAt: string | null, isWhatsApp: boolean): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isWhatsApp) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [isWhatsApp]);
  if (!isWhatsApp) return null;
  return endsAt ? new Date(endsAt).getTime() - now : 0;
}

export function Conversation({
  conversation,
  messages,
  templates,
  backHref,
}: {
  conversation: InboxConversation & { channelLabel: string };
  messages: InboxMessage[];
  templates: { name: string; label: string }[];
  backHref: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [template, setTemplate] = useState(templates[0]?.name ?? "");
  const [failure, setFailure] = useState<keyof typeof FAILURE | null>(null);
  const isWhatsApp = conversation.channel === "whatsapp";
  const left = useWindowLeft(conversation.windowEndsAt, isWhatsApp);
  const windowClosed = left !== null && left <= 0;
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  // New customer messages arrive through the webhook job; check for them while the chat is open.
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(timer);
  }, [router]);

  function toggle() {
    start(() => setTakeover(conversation.id, !conversation.agentPaused));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    start(async () => {
      const result = await sendReply(conversation.id, body);
      settle(result);
      if (result.ok) setText("");
    });
  }

  function settle(result: ReplyResult) {
    setFailure(result.ok ? null : result.reason);
  }

  function submitTemplate(e: FormEvent) {
    e.preventDefault();
    if (!template) return;
    start(async () => settle(await sendTemplate(conversation.id, template)));
  }

  const paused = conversation.agentPaused;

  return (
    <section className="flex min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-panel-3 px-4 py-2.5">
        <Link href={backHref} aria-label={i.back} className="-ml-1 grid size-8 place-items-center rounded-md text-stone transition-colors hover:bg-panel-2 hover:text-cream lg:hidden">
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <Avatar name={conversation.customerRef} channel={conversation.channel} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-cream">{conversation.customerRef}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-stone">
            {conversation.channelLabel}
            {left !== null && left > 0 && (
              <span data-window-countdown className="inline-flex items-center gap-1">
                <Clock className="size-3" aria-hidden="true" /> {i.windowLeft.replace("{time}", formatLeft(left))}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
            paused ? "border border-panel-3 bg-panel-2 text-cream hover:bg-panel-3" : "bg-lime text-black hover:bg-lime/85"
          }`}
        >
          {paused ? <Bot className="size-4" aria-hidden="true" /> : <Hand className="size-4" aria-hidden="true" />}
          <span className={paused ? "sr-only sm:not-sr-only" : undefined}>{paused ? i.handBack : i.takeOver}</span>
        </button>
      </header>

      <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-black/10 px-4 py-5 sm:px-6">
        {messages.map((m, n) => {
          const mine = m.role !== "customer";
          const newDay = n === 0 || new Date(messages[n - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          return (
            <li key={m.id} className="contents">
              {newDay && (
                <span className="my-1 self-center rounded-md border border-panel-3 bg-panel px-2 py-0.5 text-[11px] text-stone" suppressHydrationWarning>
                  {dayLabel(m.createdAt)}
                </span>
              )}
              <div className={`flex max-w-[80%] items-end gap-2 ${mine ? "flex-row-reverse self-end" : "self-start"}`}>
                {m.role === "customer" ? (
                  <Avatar name={conversation.customerRef} size="sm" />
                ) : m.role === "agent" ? (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lime/15 text-lime" aria-hidden="true">
                    <Bot className="size-3.5" />
                  </span>
                ) : null}
                <div className={`flex min-w-0 flex-col ${mine ? "items-end" : ""}`}>
                  <span className="mb-1 text-[11px] text-stone" suppressHydrationWarning>
                    {ROLE_LABEL[m.role]} · {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <p
                    className={`rounded-lg px-3.5 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere] ${
                      m.role === "seller" ? "bg-lime text-black" : m.role === "agent" ? "border border-panel-3 bg-panel-2 text-cream" : "bg-panel-3 text-cream"
                    }`}
                  >
                    {m.body}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
        <div ref={endRef} />
      </ol>

      <div className="border-t border-panel-3 p-3">
        {!paused ? (
          <p className="rounded-md bg-panel-2/60 px-3 py-2.5 text-sm text-stone">{i.hint}</p>
        ) : !conversation.canReply ? (
          <p className="px-2 py-2 text-sm text-stone">{i.channelOff}</p>
        ) : windowClosed ? (
          <form onSubmit={submitTemplate} data-template-picker className="flex flex-col gap-2">
            <p className="px-1 pt-1 text-sm text-stone">{i.windowClosed}</p>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="template">
                {i.templateLabel}
              </label>
              <NativeSelect id="template" value={template} onChange={(e) => setTemplate(e.target.value)} wrapperClassName="min-w-0 flex-1" className="h-10">
                {templates.map((x) => (
                  <option key={x.name} value={x.name}>
                    {x.label}
                  </option>
                ))}
              </NativeSelect>
              <button
                type="submit"
                disabled={pending || !template}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-lime px-4 text-sm font-medium text-black transition-colors hover:bg-lime/85 disabled:opacity-40"
              >
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="size-4" aria-hidden="true" />}
                <span className="hidden sm:inline">{i.sendTemplate}</span>
                <span className="sr-only sm:hidden">{i.sendTemplate}</span>
              </button>
            </div>
            <p className="px-1 text-xs text-stone">{i.templateNote}</p>
          </form>
        ) : (
          <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border border-panel-3 bg-panel-2 p-1.5 focus-within:border-lime/40">
            <label className="sr-only" htmlFor="seller-reply">
              {i.placeholder}
            </label>
            <input
              id="seller-reply"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={i.placeholder}
              maxLength={2000}
              className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm text-cream outline-none placeholder:text-stone"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              aria-label={i.send}
              className="grid size-9 place-items-center rounded-md bg-lime text-black transition-colors hover:bg-lime/85 disabled:opacity-40"
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="size-4" aria-hidden="true" />}
            </button>
          </form>
        )}
        {failure && (
          <p role="alert" className="px-2 pt-2 text-sm text-red-300">
            {FAILURE[failure]}
          </p>
        )}
      </div>
    </section>
  );
}
