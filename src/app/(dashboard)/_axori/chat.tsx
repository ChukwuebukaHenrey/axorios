"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import { ArrowUp, Mic, Paperclip, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { t } from "@/lib/messages";
import { useVoiceRecorder, type VoiceNote } from "./use-voice-recorder";
import { switchStore } from "../shell-actions";
import { Mascot, useMomentary, type MascotState } from "./mascot";
import { ApprovalCard, MessageParts, type ToolPart } from "./parts";
import { chipKey, chipPayload, useAxori, type Chip } from "./provider";
import { MEDIA_ACCEPT, useMediaUpload } from "./use-media-upload";

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

/** The server takes 4 chips: the page chip plus the 3 newest objects (an upload pushes out the oldest). */
function chipsToSend(chips: Chip[]) {
  return [...chips.filter((c) => c.kind === "page"), ...chips.filter((c) => c.kind !== "page").slice(-3)].map(chipPayload);
}

/**
 * `draft`: a new chat with no database row; its id is made in the browser. `fresh`: started as a draft in this tab,
 * so its requests ask the agent route to create the row with the first message (a no-op once the row exists).
 */
export type ChatThread = { id: string; storeId: string | null; messages: UIMessage[]; draft?: boolean; fresh?: boolean };

/** Unsent text in a new chat survives navigation and reloads in this tab only, and goes when the tab closes. */
const draftKey = (account: boolean) => `axori:draft:${account ? "account" : "store"}`;
function readDraft(key: string) {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function writeDraft(key: string, text: string) {
  try {
    if (text) sessionStorage.setItem(key, text);
    else sessionStorage.removeItem(key);
  } catch {}
}

export function AxoriChat({
  thread,
  greetingName,
  variant,
  onTitle,
  onStart,
  initialInput,
}: {
  thread: ChatThread;
  storeName?: string;
  greetingName: string;
  variant: "panel" | "page";
  onTitle?: () => void;
  /** Draft only: the first message is on its way, so the parent shows this chat as a saved thread. */
  onStart?: (id: string, storeId: string | null) => void;
  /** Prefills a new chat's composer (a `?prompt=` link). Never sent on its own. */
  initialInput?: string;
}) {
  const [saved, setSaved] = useState(!thread.draft);
  const isDraft = !saved;
  const router = useRouter();
  const { chips, getChips, addChip, removeChip, setMascot, holding, takePending, pending } = useAxori();
  const [input, setInput] = useState(initialInput ?? "");
  const endRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const isAccount = thread.storeId === null;
  const fresh = Boolean(thread.fresh);
  const key = draftKey(isAccount);

  // Bring back unsent text from earlier in this tab (after mount, so the server render matches).
  useEffect(() => {
    if (!thread.draft || initialInput) return;
    const text = readDraft(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (text) setInput(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (isDraft) writeDraft(key, input);
  }, [isDraft, key, input]);

  /** The first real message is going out: from here the route saves the chat with it. */
  const began = useCallback(() => {
    if (saved) return;
    setSaved(true);
    writeDraft(key, "");
    onStart?.(thread.id, thread.storeId);
  }, [saved, key, onStart, thread.id, thread.storeId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            threadId: thread.id,
            ...(fresh && { newThread: isAccount ? "account" : "store" }),
            context: isAccount ? [] : chipsToSend(getChips()),
            // Audio goes up once, in the turn it was spoken; later turns carry the transcript.
            messages: messages.map((message, index) =>
              index === messages.length - 1
                ? message
                : { ...message, parts: message.parts.map((part) => (part.type === "file" ? { type: "text" as const, text: t.builder.voiceNote } : part)) },
            ),
          },
        }),
      }),
    [thread.id, isAccount, fresh, getChips],
  );
  const { messages, sendMessage, addToolApprovalResponse, status, error } = useChat({
    id: thread.id,
    messages: thread.messages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const busy = status === "submitted" || status === "streaming";
  const sendVoice = useCallback(
    (note: VoiceNote) => {
      void sendMessage({ files: [{ type: "file", mediaType: note.mediaType, url: note.url }] });
      began();
    },
    [sendMessage, began],
  );
  const voice = useVoiceRecorder(sendVoice);
  // A draft's upload goes to the library under the session's store; the chat stays a draft until a message.
  const media = useMediaUpload(saved ? thread.id : undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const attach = async (file: File | undefined) => {
    if (!file || media.state.status === "uploading") return;
    const item = await media.upload(file);
    // Store threads see the file through a chip; the server re-reads it, scoped to the store.
    if (item && !isAccount) addChip({ kind: "media", id: item.id, label: item.name });
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void attach(e.dataTransfer.files[0]);
  };

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
    if (!text) return;
    void sendMessage({ text });
    // The hand-over comes from outside this chat (the search palette), so marking the draft saved belongs here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    began();
  }, [pending, busy, takePending, sendMessage, began]);

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
  // A new chat appears in the history as soon as its row exists (the stream has started), then again with its title.
  useEffect(() => {
    if ((status === "streaming" || status === "ready") && turns === 1) onTitle?.();
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
    void sendMessage({ text: clean });
    began();
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
  const page = variant === "page";
  // The page and store are known from the session; only things the seller pinned (an order, a file) show here.
  const pinned = isAccount ? [] : chips.filter((c) => c.kind !== "page");

  const notices = (
    <>
      {(voice.recording || voice.error) && (
        <p role="status" className={`mb-2 rounded-lg px-3 py-2 text-sm ${voice.error ? "bg-red-500/15 text-red-200" : "bg-[#2b3118] text-lime"}`}>
          {voice.error === "denied" ? t.builder.micDenied : voice.error === "unsupported" ? t.builder.micUnsupported : a.listening.replace("{seconds}", String(voice.seconds))}
        </p>
      )}
      {media.state.status !== "idle" && (
        <p
          role="status"
          data-media-status={media.state.status}
          className={`mb-2 flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm ${media.state.status === "error" ? "bg-red-500/15 text-red-200" : "bg-[#2b3118] text-lime"}`}
        >
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {media.state.status === "uploading" && a.attaching.replace("{name}", media.state.name)}
            {media.state.status === "error" && media.state.message}
            {media.state.status === "done" && a.attached.replace("{name}", media.state.item.name).replace("{tags}", media.state.item.tags.join(", ") || "—")}
          </span>
          {media.state.status !== "uploading" && (
            <button type="button" onClick={media.reset} aria-label={a.dismiss} className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-black/30">
              <X className="size-3" aria-hidden="true" />
            </button>
          )}
        </p>
      )}
    </>
  );

  const composer = (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`rounded-xl border bg-panel-2 shadow-[0_4px_24px_rgb(0_0_0/0.35)] transition-colors focus-within:border-cream/25 ${dragging ? "border-lime" : "border-panel-3"}`}
    >
      {pinned.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3 text-xs">
          {pinned.map((chip) => (
            <span key={chipKey(chip)} className="inline-flex items-center gap-1 rounded-md border border-lime/20 bg-[#2b3118] py-0.5 pr-1 pl-2 text-lime">
              {chip.label}
              <button
                type="button"
                onClick={() => removeChip(chipKey(chip))}
                aria-label={a.removeChip.replace("{label}", chip.label)}
                className="grid size-4 place-items-center rounded hover:bg-black/30"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <label htmlFor={`axori-input-${variant}`} className="sr-only">
        {a.placeholder}
      </label>
      <textarea
        id={`axori-input-${variant}`}
        ref={areaRef}
        rows={page && empty ? 2 : 1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        placeholder={a.placeholder}
        autoFocus
        className="block max-h-40 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-6 text-cream placeholder:text-stone outline-none"
      />
      <div className="flex items-center gap-1 px-2 pb-2">
        <input
          ref={fileRef}
          type="file"
          accept={MEDIA_ACCEPT}
          className="hidden"
          data-axori-file
          onChange={(e) => {
            void attach(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={media.state.status === "uploading"}
          aria-label={a.attach}
          title={a.attach}
          className="grid size-8 place-items-center rounded-md border border-panel-3 text-cream/80 transition hover:bg-panel-3 hover:text-cream disabled:opacity-40"
        >
          <Paperclip className="size-4" aria-hidden="true" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={voice.recording ? voice.stop : voice.start}
            disabled={busy && !voice.recording}
            aria-label={voice.recording ? a.micStop : a.micStart}
            aria-pressed={voice.recording}
            className={`grid size-8 place-items-center rounded-md transition disabled:opacity-40 ${voice.recording ? "bg-red-600 text-white" : "text-cream/80 hover:bg-panel-3 hover:text-cream"}`}
          >
            {voice.recording ? <Square className="size-3.5" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            aria-label={a.send}
            className="grid size-8 place-items-center rounded-md bg-lime text-black transition hover:bg-lime/85 active:scale-95 disabled:opacity-40"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  if (empty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4" aria-live="polite">
        <div className={`m-auto flex w-full flex-col py-8 ${page ? "max-w-2xl" : ""}`}>
          <div className="mb-6 flex items-center justify-center gap-3">
            <Mascot state={mascot} size={page ? 48 : 40} />
            <h2 className={`font-medium tracking-tight text-cream ${page ? "text-[28px]" : "text-xl"}`}>
              {isAccount ? a.accountGreeting : greetingName ? a.greeting.replace("{name}", greetingName) : a.greetingAnon}
            </h2>
          </div>
          {notices}
          {composer}
          <div className={`mt-3 flex flex-wrap justify-center gap-2 ${page ? "" : "flex-col"}`}>
            {suggestions.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => send(s.prompt)}
                title={s.body}
                className="rounded-md border border-panel-3 px-3 py-1.5 text-left text-[13px] text-cream/80 transition hover:border-cream/25 hover:bg-panel-2 hover:text-cream"
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${page ? "px-4 sm:px-8" : "px-4"}`} aria-live="polite">
        <div className={`mx-auto flex w-full flex-col gap-5 py-6 ${page ? "max-w-3xl" : ""}`}>
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "assistant" && <Mascot state={message.id === messages.at(-1)?.id ? mascot : "idle"} size={28} className="mt-0.5" />}
              <div className={`flex min-w-0 flex-col gap-2 ${message.role === "user" ? "max-w-[85%] items-end" : "flex-1"}`}>
                <MessageParts message={message} handlers={{ onRespond: respond, onChoose: send, renderTool, busy }} />
              </div>
            </div>
          ))}
          {status === "submitted" && (
            <div className="flex items-center gap-3 text-sm text-stone">
              <Mascot state="thinking" size={28} /> {t.builder.thinking}…
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error.message.includes("daily_limit") ? a.dailyLimit : a.error}
            </p>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className={`shrink-0 pb-3 ${page ? "mx-auto w-full max-w-3xl px-4 sm:px-8" : "px-3"}`}>
        {notices}
        {composer}
        <p className="mt-2 text-center text-[11px] text-stone">{a.disclaimer}</p>
      </div>
    </div>
  );
}
