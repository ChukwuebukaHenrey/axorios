"use client";

import { Bot, Hand, Loader2, SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { t } from "@/lib/messages";
import type { InboxConversation, InboxMessage } from "@/modules/channels";
import { sendReply, setTakeover } from "./actions";

const i = t.app.inbox;
const ROLE_LABEL = { customer: i.customer, agent: i.agent, seller: i.seller } as const;

export function Conversation({
  conversation,
  messages,
}: {
  conversation: InboxConversation & { channelLabel: string };
  messages: InboxMessage[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
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
      const { ok } = await sendReply(conversation.id, body);
      setFailed(!ok);
      if (ok) setText("");
    });
  }

  const paused = conversation.agentPaused;

  return (
    <section className="flex min-h-[480px] flex-1 flex-col rounded-2xl border border-panel-3 bg-panel">
      <header className="flex flex-wrap items-center gap-3 border-b border-panel-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-cream">{conversation.customerRef}</p>
          <p className="text-sm text-stone">{conversation.channelLabel}</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:opacity-50 ${
            paused ? "border border-panel-3 bg-panel-2 text-cream hover:border-cream/30" : "bg-lime text-black hover:bg-lime/85"
          }`}
        >
          {paused ? <Bot className="size-4" aria-hidden="true" /> : <Hand className="size-4" aria-hidden="true" />}
          {paused ? i.handBack : i.takeOver}
        </button>
      </header>

      <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
        {messages.map((m) => {
          const mine = m.role !== "customer";
          return (
            <li key={m.id} className={`flex max-w-[80%] flex-col ${mine ? "self-end items-end" : "self-start"}`}>
              <span className="mb-1 text-xs text-stone" suppressHydrationWarning>
                {ROLE_LABEL[m.role]} · {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </span>
              <p
                className={`rounded-xl px-4 py-2.5 whitespace-pre-wrap [overflow-wrap:anywhere] ${
                  m.role === "seller" ? "bg-lime text-black" : m.role === "agent" ? "border border-panel-3 bg-panel-2 text-cream" : "bg-panel-3 text-cream"
                }`}
              >
                {m.body}
              </p>
            </li>
          );
        })}
        <div ref={endRef} />
      </ol>

      <div className="border-t border-panel-3 p-3">
        {!paused ? (
          <p className="px-2 py-2 text-sm text-stone">{i.hint}</p>
        ) : !conversation.canReply ? (
          <p className="px-2 py-2 text-sm text-stone">{i.channelOff}</p>
        ) : (
          <form onSubmit={submit} className="flex gap-2">
            <label className="sr-only" htmlFor="seller-reply">
              {i.placeholder}
            </label>
            <input
              id="seller-reply"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={i.placeholder}
              maxLength={2000}
              className="h-12 min-w-0 flex-1 rounded-lg border border-panel-3 bg-panel-2 px-4 text-cream placeholder:text-stone outline-none focus:border-cream/40"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              aria-label={i.send}
              className="grid size-12 place-items-center rounded-lg bg-lime text-black transition hover:bg-lime/85 disabled:opacity-40"
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="size-4" aria-hidden="true" />}
            </button>
          </form>
        )}
        {failed && <p className="px-2 pt-2 text-sm text-red-300">{i.sendFailed}</p>}
      </div>
    </section>
  );
}
