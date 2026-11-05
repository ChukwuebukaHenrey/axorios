"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import { Loader2, Mic, SendHorizontal, Square, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type FormEvent } from "react";
import { t } from "@/lib/messages";
import type { BrandKit } from "@/modules/brand";
import type { Product } from "@/modules/catalog";
import { BrandCard } from "./brand-card";
import { CampaignCard } from "./campaign-card";
import { PreviewPane } from "./preview-pane";
import { ProductsCard } from "./products-card";
import { PublishCard } from "./publish-card";
import { ScheduleCard } from "./schedule-card";
import { ShopifyCard } from "./shopify-card";
import { useVoiceRecorder, type VoiceNote } from "./use-voice-recorder";

const BRAND_TOOL_TYPES = new Set(["tool-create_brand_kit", "tool-update_brand_kit", "tool-suggest_names"]);
/** Any of these changes what the store looks like, so the preview reloads when one finishes. */
const SITE_TOOL_TYPES = new Set([
  ...BRAND_TOOL_TYPES,
  "tool-add_products",
  "tool-edit_site",
  "tool-revert_site",
  "tool-choose_template",
]);

type ToolPart = { type: string; state?: string; output?: unknown };

function brandOutput(part: ToolPart): BrandKit | null {
  return BRAND_TOOL_TYPES.has(part.type) && part.state === "output-available" ? (part.output as BrandKit) : null;
}

function productsOutput(part: ToolPart): Product[] | null {
  return part.type === "tool-add_products" && part.state === "output-available" ? (part.output as Product[]) : null;
}

export function BuilderChat({
  initialMessages,
  previewUrl,
  initialHasKit,
  presets,
}: {
  initialMessages: UIMessage[];
  previewUrl: string;
  initialHasKit: boolean;
  presets: { id: string; label: string }[];
}) {
  const [input, setInput] = useState("");
  const [view, setView] = useState<"chat" | "preview">("chat");
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        // Audio goes up once, in the turn it was spoken. After that the model has the transcript, so requests stay small.
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages: messages.map((message, index) =>
              index === messages.length - 1
                ? message
                : { ...message, parts: message.parts.map((part) => (part.type === "file" ? { type: "text" as const, text: t.builder.voiceNote } : part)) },
            ),
          },
        }),
      }),
    [],
  );
  const { messages, sendMessage, addToolApprovalResponse, status, error } = useChat({
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const busy = status === "submitted" || status === "streaming";
  const sendVoiceNote = useCallback(
    ({ mediaType, url }: VoiceNote) => {
      sendMessage({ files: [{ type: "file", mediaType, url }] });
    },
    [sendMessage],
  );
  const voice = useVoiceRecorder(sendVoiceNote);

  const previewVersion = useMemo(
    () =>
      messages
        .flatMap((message) => message.parts as ToolPart[])
        .filter((part) => SITE_TOOL_TYPES.has(part.type) && part.state === "output-available").length,
    [messages],
  );

  // A store has nothing to preview until its brand kit exists.
  const hasKit =
    initialHasKit || messages.some((message) => (message.parts as ToolPart[]).some((part) => brandOutput(part) !== null));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function selectSection(id: string) {
    setSelectedSection(id);
    setView("chat");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage({ text }, selectedSection ? { body: { selectedSectionId: selectedSection } } : undefined);
    setSelectedSection(null);
  }

  const tab = (active: boolean) =>
    `h-11 flex-1 text-sm font-semibold ${active ? "border-b-2 border-secondary text-primary" : "text-black/60"}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex shrink-0 border-b border-black/10 bg-white md:hidden">
        <button type="button" role="tab" aria-selected={view === "chat"} onClick={() => setView("chat")} className={tab(view === "chat")}>
          {t.builder.tabChat}
        </button>
        <button type="button" role="tab" aria-selected={view === "preview"} onClick={() => setView("preview")} className={tab(view === "preview")}>
          {t.builder.tabPreview}
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <section
          className={`${view === "chat" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col md:flex md:max-w-md md:border-r md:border-black/10 lg:max-w-lg`}
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && <p className="rounded-2xl bg-white p-4 shadow-sm">{t.builder.greeting}</p>}
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex flex-col items-end" : "flex flex-col"}>
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <p
                        key={i}
                        className={
                          message.role === "user"
                            ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 whitespace-pre-wrap text-white"
                            : "max-w-[85%] rounded-2xl bg-white px-4 py-2.5 whitespace-pre-wrap shadow-sm"
                        }
                      >
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type === "tool-publish_store") {
                    return (
                      <PublishCard
                        key={i}
                        part={part as ComponentProps<typeof PublishCard>["part"]}
                        onRespond={(id, approved) => addToolApprovalResponse({ id, approved })}
                      />
                    );
                  }
                  if (part.type === "file") {
                    return (
                      <p key={i} className="flex max-w-[85%] items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-white">
                        <Mic className="size-4" aria-hidden="true" /> {t.builder.voiceNote}
                      </p>
                    );
                  }
                  if (part.type === "tool-show_transcript") {
                    const said = (part as { input?: { transcript?: string } }).input?.transcript;
                    return said ? (
                      <p key={i} className="my-1 max-w-[85%] border-l-2 border-secondary pl-3 text-sm text-black/70">
                        <span className="font-semibold">{t.builder.youSaid}</span> {said}
                      </p>
                    ) : null;
                  }
                  if (part.type === "tool-connect_shopify" || part.type === "tool-sync_to_shopify") {
                    return (
                      <ShopifyCard
                        key={i}
                        kind={part.type === "tool-connect_shopify" ? "connect" : "sync"}
                        part={part as ComponentProps<typeof ShopifyCard>["part"]}
                        onRespond={(id, approved) => addToolApprovalResponse({ id, approved })}
                      />
                    );
                  }
                  if (part.type === "tool-schedule_posts") {
                    return (
                      <ScheduleCard
                        key={i}
                        part={part as ComponentProps<typeof ScheduleCard>["part"]}
                        onRespond={(id, approved) => addToolApprovalResponse({ id, approved })}
                      />
                    );
                  }
                  if (part.type === "tool-generate_campaign" && (part as ToolPart).state === "output-available") {
                    const queued = (part as ToolPart).output as { campaignId?: string; count?: number };
                    return queued.campaignId ? <CampaignCard key={i} campaignId={queued.campaignId} count={queued.count ?? 3} /> : null;
                  }
                  const kit = brandOutput(part as ToolPart);
                  if (kit) {
                    return (
                      <div key={i} className="my-2 w-full max-w-sm">
                        <BrandCard kit={kit} />
                      </div>
                    );
                  }
                  const products = productsOutput(part as ToolPart);
                  return products ? (
                    <div key={i} className="my-2 w-full max-w-sm">
                      <ProductsCard products={products} />
                    </div>
                  ) : null;
                })}
              </div>
            ))}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-black/60">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t.builder.thinking}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {t.builder.error}
              </p>
            )}
            <div ref={endRef} />
          </div>
          {selectedSection && (
            <p className="flex items-center justify-between gap-2 border-t border-black/10 bg-accent/30 px-4 py-2 text-sm">
              <span className="truncate">
                {t.builder.editing} <strong>{selectedSection}</strong>
              </span>
              <button
                type="button"
                aria-label={t.builder.clearSelection}
                onClick={() => setSelectedSection(null)}
                className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-black/5"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </p>
          )}
          {(voice.recording || voice.error) && (
            <p role="status" className={`border-t border-black/10 px-4 py-2 text-sm ${voice.error ? "bg-red-50 text-red-800" : "bg-accent/30"}`}>
              {voice.error === "denied"
                ? t.builder.micDenied
                : voice.error === "unsupported"
                  ? t.builder.micUnsupported
                  : t.builder.micListening.replace("{seconds}", String(voice.seconds))}
            </p>
          )}
          <form onSubmit={submit} className="flex gap-2 border-t border-black/10 bg-white p-3">
            <button
              type="button"
              disabled={busy}
              onClick={voice.recording ? voice.stop : voice.start}
              aria-label={voice.recording ? t.builder.micStop : t.builder.micStart}
              aria-pressed={voice.recording}
              className={`grid size-12 shrink-0 place-items-center rounded-xl transition disabled:opacity-50 ${
                voice.recording ? "animate-pulse bg-red-600 text-white" : "bg-primary text-white hover:opacity-90"
              }`}
            >
              {voice.recording ? <Square className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.builder.placeholder}
              aria-label={t.builder.placeholder}
              className="h-12 min-w-0 flex-1 rounded-xl border border-black/15 px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t.builder.send}
              className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-ink transition hover:bg-accent disabled:opacity-50"
            >
              <SendHorizontal className="size-5" aria-hidden="true" />
            </button>
          </form>
        </section>
        <aside className={`${view === "preview" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col md:flex`}>
          <PreviewPane
            url={hasKit ? previewUrl : null}
            version={previewVersion}
            presets={presets}
            publishing={busy}
            onSelectSection={selectSection}
            onPublish={() => {
              setView("chat");
              sendMessage({ text: t.builder.publishRequest });
            }}
          />
        </aside>
      </div>
    </div>
  );
}
