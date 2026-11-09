"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import { ArrowUp, Mic, Square, Store, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { t } from "@/lib/messages";
import { useVoiceRecorder, type VoiceNote } from "../build/use-voice-recorder";
import { switchStore } from "../shell-actions";
import { Mascot, useMomentary, type MascotState } from "./mascot";
import { ApprovalCard, MessageParts, type ToolPart } from "./parts";
import { chipKey, chipPayload, useAxori } from "./provider";

const a = t.app.axori;

/** Tools that change what the shell shows (counts, store list), so server data refreshes when one finishes. */
const REFRESH_TOOLS = /^tool-(publish_store|schedule_posts|sync_to_shopify|connect_shopify|refund_order|create_store|add_products|create_brand_kit|update_brand_kit)$/;

function deriveMascot(messages: UIMessage[], status: string, failed: boolean, recording: boolean, surprised: boolean): MascotState {
  if (recording) return "listening";
  if (failed) return "confused";
  if (surprised) return "surprised";
  const last = messages.at(-1);
  const parts = (last?.role === "assistant" ? last.parts : []) as ToolPart[];
  const tail = parts.at(-1);
  if (status === "submitted") return "thinking";
  if (status === "streaming") {
    if (tail?.type.startsWith("tool-") && tail.state !== "output-available") return "thinking";
    return tail?.type === "text" ? "speaking" : "thinking";
  }
  return "idle";
}

export type ChatThread = { id: string; storeId: string | null; messages: UIMessage[] };

export function AxoriChat({
  thread,
  storeName,
  greetingName,
  variant,
  onTitle,
}: {
  thread: ChatThread;
  storeName: string;
  greetingName: string;
  variant: "panel" | "page";
  onTitle?: () => void;
}) {
  const router = useRouter();
  const { chips, getChips, removeChip, setMascot, holding, takePending, pending } = useAxori();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const isAccount = thread.storeId === null;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            threadId: thread.id,
            context: isAccount ? [] : getChips().map(chipPayload),
            // Audio goes up once, in the turn it was spoken; later turns carry the transcript.
            messages: messages.map((message, index) =>
              index === messages.length - 1
                ? message
                : { ...message, parts: message.parts.map((part) => (part.type === "file" ? { type: "text" as const, text: t.builder.voiceNote } : part)) },
            ),
          },
        }),
      }),
    [thread.id, isAccount, getChips],
  );
  const { messages, sendMessage, addToolApprovalResponse, status, error } = useChat({
    id: thread.id,
    messages: thread.messages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const busy = status === "submitted" || status === "streaming";
  const sendVoice = useCallback(({ mediaType, url }: VoiceNote) => sendMessage({ files: [{ type: "file", mediaType, url }] }), [sendMessage]);
  const voice = useVoiceRecorder(sendVoice);

  // Hold-to-talk from the mobile button.
  const { start: startVoice, stop: stopVoice, recording } = voice;
  useEffect(() => {
    if (holding && !recording) void startVoice();
    if (!holding && recording) stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);

  // Search's "Ask Axori AI" hands its text over once.
  useEffect(() => {
    if (pending === null || busy) return;
    const text = takePending();
    if (text) sendMessage({ text });
  }, [pending, busy, takePending, sendMessage]);

  const approvalsSeen = useMemo(
    () => messages.flatMap((m) => m.parts as ToolPart[]).filter((p) => p.state === "approval-requested").length,
    [messages],
  );
  const surprised = useMomentary(approvalsSeen);
  const mascot = deriveMascot(messages, status, Boolean(error), voice.recording, surprised);
  useEffect(() => setMascot(mascot), [mascot, setMascot]);
  useEffect(() => () => setMascot("idle"), [setMascot]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const finished = useMemo(
    () => messages.flatMap((m) => m.parts as ToolPart[]).filter((p) => REFRESH_TOOLS.test(p.type) && p.state === "output-available").length,
    [messages],
  );
  const seen = useRef(finished);
  useEffect(() => {
    if (finished === seen.current) return;
    seen.current = finished;
    router.refresh();
  }, [finished, router]);
  // The thread gets its title from the first message, saved when the turn ends.
  const turns = messages.filter((m) => m.role === "user").length;
  useEffect(() => {
    if (status === "ready" && turns === 1) onTitle?.();
  }, [status, turns, onTitle]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput("");
    sendMessage({ text: clean });
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }
  const respond = (id: string, approved: boolean) => addToolApprovalResponse({ id, approved });

  const renderTool = (part: ToolPart) => {
    if (part.type !== "tool-create_store") return null;
    const created = part.output as { storeId?: string } | undefined;
    return (
      <ApprovalCard part={part} title={a.approval.tools.create_store} onRespond={respond}>
        {created?.storeId ? (
          <button
            type="button"
            onClick={async () => {
              await switchStore(created.storeId!);
              router.refresh();
            }}
            className="mt-1 rounded-lg bg-lime px-3 py-1.5 text-sm font-semibold text-black"
          >
            {a.switchToStore}
          </button>
        ) : (
          <p>{(part.input as { idea?: string } | undefined)?.idea}</p>
        )}
      </ApprovalCard>
    );
  };

  const suggestions = isAccount ? a.accountSuggestions : a.suggestions;
  const empty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${variant === "page" ? "px-4 sm:px-8" : "px-4"}`} aria-live="polite">
        {empty ? (
          <div className="m-auto flex w-full max-w-2xl flex-col items-center py-8 text-center">
            <Mascot state={mascot} size={variant === "page" ? 140 : 96} />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-cream">
              {isAccount ? a.accountGreeting : a.greeting.replace("{name}", greetingName)}
            </h2>
            <p className="mt-2 max-w-md text-sm text-stone">{isAccount ? a.accountGreetingBody : a.greetingBody}</p>
            <div className={`mt-6 grid w-full gap-2.5 ${variant === "page" ? "sm:grid-cols-3" : ""}`}>
              {suggestions.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => send(s.prompt)}
                  className="rounded-2xl border border-panel-3 bg-panel-2 p-4 text-left transition hover:border-lime/40"
                >
                  <span className="block font-medium text-cream">{s.title}</span>
                  <span className="mt-1 block text-sm text-stone">{s.body}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={`mx-auto flex w-full flex-col gap-5 py-4 ${variant === "page" ? "max-w-3xl" : ""}`}>
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                {message.role === "assistant" && <Mascot state={message.id === messages.at(-1)?.id ? mascot : "idle"} size={32} className="mt-0.5" />}
                <div className={`flex min-w-0 flex-col gap-2 ${message.role === "user" ? "max-w-[85%] items-end" : "flex-1"}`}>
                  <MessageParts message={message} handlers={{ onRespond: respond, onChoose: send, renderTool, busy }} />
                </div>
              </div>
            ))}
            {status === "submitted" && (
              <div className="flex items-center gap-3 text-sm text-stone">
                <Mascot state="thinking" size={32} /> {t.builder.thinking}…
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error.message.includes("daily_limit") ? a.dailyLimit : a.error}
              </p>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className={`shrink-0 pb-3 ${variant === "page" ? "mx-auto w-full max-w-3xl px-4 sm:px-8" : "px-3"}`}>
        {(voice.recording || voice.error) && (
          <p role="status" className={`mb-2 rounded-lg px-3 py-2 text-sm ${voice.error ? "bg-red-500/15 text-red-200" : "bg-[#2b3118] text-lime"}`}>
            {voice.error === "denied" ? t.builder.micDenied : voice.error === "unsupported" ? t.builder.micUnsupported : a.listening.replace("{seconds}", String(voice.seconds))}
          </p>
        )}
        <div className="rounded-2xl border border-panel-3 bg-panel-2 p-3 focus-within:border-cream/30">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs" aria-label={a.sees}>
            <span className="text-stone">{a.sees}:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-panel-3 px-2 py-0.5 text-cream">
              <Store className="size-3" aria-hidden="true" /> {isAccount ? a.accountScope : storeName}
            </span>
            {!isAccount &&
              chips.map((chip) => (
                <span key={chipKey(chip)} className="inline-flex items-center gap-1 rounded-full bg-[#2b3118] py-0.5 pr-1 pl-2 text-lime">
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => removeChip(chipKey(chip))}
                    aria-label={a.removeChip.replace("{label}", chip.label)}
                    className="grid size-4 place-items-center rounded-full hover:bg-black/30"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
          </div>
          <label htmlFor={`axori-input-${variant}`} className="sr-only">
            {a.placeholder}
          </label>
          <textarea
            id={`axori-input-${variant}`}
            ref={areaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={a.placeholder}
            autoFocus={variant === "panel"}
            className="block max-h-40 w-full resize-none bg-transparent text-base text-cream placeholder:text-stone outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={voice.recording ? voice.stop : voice.start}
              disabled={busy && !voice.recording}
              aria-label={voice.recording ? a.micStop : a.micStart}
              aria-pressed={voice.recording}
              className={`grid size-9 place-items-center rounded-full transition disabled:opacity-40 ${voice.recording ? "bg-red-600 text-white" : "text-cream/80 hover:bg-panel-3 hover:text-cream"}`}
            >
              {voice.recording ? <Square className="size-3.5" aria-hidden="true" /> : <Mic className="size-4.5" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              aria-label={a.send}
              className="grid size-9 place-items-center rounded-full bg-lime text-black transition hover:bg-lime/85 disabled:opacity-40"
            >
              <ArrowUp className="size-4.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-stone">{a.disclaimer}</p>
      </div>
    </div>
  );
}
