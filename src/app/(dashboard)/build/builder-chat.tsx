"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import { CheckCircle2, Loader2, Mic, PanelRightOpen } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";
import type { BrandKit } from "@/modules/brand";
import type { Product } from "@/modules/catalog";
import { AgentIntro } from "./agent-intro";
import { BrandCard } from "./brand-card";
import { CampaignCard } from "./campaign-card";
import { ChatInput } from "./chat-input";
import { PreviewPane } from "./preview-pane";
import { ProductsCard } from "./products-card";
import { PublishCard } from "./publish-card";
import { ScheduleCard } from "./schedule-card";
import { ShopifyCard } from "./shopify-card";
import { StatusCards, type BuildOverview } from "./status-cards";
import { useVoiceRecorder, type VoiceNote } from "./use-voice-recorder";

const b = t.app.build;
const BRAND_TOOL_TYPES = new Set(["tool-create_brand_kit", "tool-update_brand_kit", "tool-suggest_names"]);
/** Any of these changes what the store looks like, so the preview reloads when one finishes. */
const SITE_TOOL_TYPES = new Set([...BRAND_TOOL_TYPES, "tool-add_products", "tool-edit_site", "tool-revert_site", "tool-choose_template"]);
/** These change what the status cards and sidebar show, so the server data refreshes when one finishes. */
const REFRESH_TOOL_TYPES = new Set([...SITE_TOOL_TYPES, "tool-publish_store", "tool-schedule_posts", "tool-connect_shopify", "tool-sync_to_shopify", "tool-generate_campaign"]);

type ToolPart = { type: string; state?: string; output?: unknown };

function brandOutput(part: ToolPart): BrandKit | null {
  return BRAND_TOOL_TYPES.has(part.type) && part.state === "output-available" ? (part.output as BrandKit) : null;
}

function productsOutput(part: ToolPart): Product[] | null {
  return part.type === "tool-add_products" && part.state === "output-available" ? (part.output as Product[]) : null;
}

function completed(messages: UIMessage[], types: Set<string>) {
  return messages.flatMap((m) => m.parts as ToolPart[]).filter((p) => types.has(p.type) && p.state === "output-available").length;
}

function Speaker({ role, initials }: { role: UIMessage["role"]; initials: string }) {
  return role === "user" ? (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-full bg-panel-3 text-sm text-cream">{initials}</span>
      <span className="font-medium text-cream">{b.you}</span>
    </span>
  ) : (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-lg bg-lime">
        <Logo className="size-6" />
      </span>
      <span className="font-medium text-cream">{b.agent}</span>
    </span>
  );
}

export function BuilderChat({
  initialMessages,
  previewUrl,
  initialHasKit,
  presets,
  overview,
  storeSlug,
  initials,
  initialInput,
  templateLabel,
}: {
  initialMessages: UIMessage[];
  previewUrl: string;
  initialHasKit: boolean;
  presets: { id: string; label: string }[];
  overview: BuildOverview;
  storeSlug: string;
  initials: string;
  initialInput: string;
  templateLabel: string | null;
}) {
  const router = useRouter();
  const [input, setInput] = useState(initialInput);
  const [view, setView] = useState<"chat" | "preview">("chat");
  // Closing the preview hides it until the store next changes, then it opens again to show the change.
  const [closedAt, setClosedAt] = useState<number | null>(null);
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
  const sendVoiceNote = useCallback(({ mediaType, url }: VoiceNote) => sendMessage({ files: [{ type: "file", mediaType, url }] }), [sendMessage]);
  const voice = useVoiceRecorder(sendVoiceNote);

  const previewVersion = useMemo(() => completed(messages, SITE_TOOL_TYPES), [messages]);
  const refreshVersion = useMemo(() => completed(messages, REFRESH_TOOL_TYPES), [messages]);
  const latestKit = useMemo(
    () => messages.flatMap((m) => m.parts as ToolPart[]).map(brandOutput).filter(Boolean).at(-1) ?? overview.kit,
    [messages, overview.kit],
  );
  // A store has nothing to preview until its brand kit exists.
  const hasKit = initialHasKit || Boolean(latestKit);
  const previewOpen = hasKit && (closedAt === null || refreshVersion > closedAt);
  const setPreviewOpen = (open: boolean) => setClosedAt(open ? null : refreshVersion);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  // Status cards and sidebar counts are server data: refresh them when a tool that changes them finishes.
  const seen = useRef(refreshVersion);
  useEffect(() => {
    if (refreshVersion === seen.current) return;
    seen.current = refreshVersion;
    router.refresh();
  }, [refreshVersion, router]);

  const selectSection = useCallback((id: string) => {
    setSelectedSection(id);
    setView("chat");
  }, []);

  function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput("");
    sendMessage({ text: clean }, selectedSection ? { body: { selectedSectionId: selectedSection } } : undefined);
    setSelectedSection(null);
    setView("chat");
  }

  /** Cards and quick actions draft the request; the seller still reads it and presses send. */
  function draft(text: string) {
    setInput(text);
    setView("chat");
    requestAnimationFrame(() => document.getElementById("builder-input")?.focus());
  }

  const publish = () => send(t.builder.publishRequest);

  const tab = (active: boolean) => `h-10 flex-1 rounded-lg text-sm font-medium ${active ? "bg-panel-3 text-cream" : "text-stone"}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6 lg:px-8">
      <div className="shrink-0">
        <h1 className="text-[clamp(1.6rem,2.6vw,2.25rem)] leading-tight font-semibold tracking-[-0.02em] text-cream">{b.title}</h1>
        <p className="mt-1 hidden text-base text-cream/75 sm:block">{b.subtitle}</p>
      </div>

      <div role="tablist" className="mt-4 flex shrink-0 gap-1 rounded-xl border border-panel-3 bg-panel p-1 lg:hidden">
        <button type="button" role="tab" aria-selected={view === "chat"} onClick={() => setView("chat")} className={tab(view === "chat")}>
          {t.builder.tabChat}
        </button>
        <button type="button" role="tab" aria-selected={view === "preview"} onClick={() => setView("preview")} className={tab(view === "preview")}>
          {t.builder.tabPreview}
        </button>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 lg:mt-6 lg:grid-cols-[minmax(360px,460px)_minmax(0,1fr)] xl:grid-cols-[minmax(400px,480px)_minmax(0,1fr)]">
        <section className={`${view === "chat" ? "flex" : "hidden"} min-h-0 flex-col rounded-2xl border border-panel-3 bg-panel lg:flex`}>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5" aria-live="polite">
            {messages.length === 0 && <AgentIntro onPick={send} />}
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col gap-2.5">
                <Speaker role={message.role} initials={initials} />
                <div className="flex flex-col gap-2 pl-11.5">
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return message.role === "user" ? (
                        <p key={i} className="rounded-xl border border-panel-3 bg-panel-2 px-4 py-3 whitespace-pre-wrap text-cream [overflow-wrap:anywhere]">
                          {part.text}
                        </p>
                      ) : (
                        <p key={i} className="whitespace-pre-wrap text-cream/90 [overflow-wrap:anywhere]">
                          {part.text}
                        </p>
                      );
                    }
                    if (part.type === "file") {
                      return (
                        <p key={i} className="flex items-center gap-3 rounded-xl border border-panel-3 bg-panel-2 px-4 py-3 text-cream">
                          <Mic className="size-4 text-lime" aria-hidden="true" /> {t.builder.voiceNote}
                        </p>
                      );
                    }
                    if (part.type === "tool-show_transcript") {
                      const said = (part as { input?: { transcript?: string } }).input?.transcript;
                      return said ? (
                        <p key={i} className="rounded-xl border border-panel-3 bg-panel-2 px-4 py-3 text-sm text-cream/90">
                          <span className="font-semibold text-cream">{t.builder.youSaid}</span> “{said}”
                        </p>
                      ) : null;
                    }
                    if (part.type === "tool-publish_store") {
                      return (
                        <PublishCard key={i} part={part as ComponentProps<typeof PublishCard>["part"]} onRespond={(id, approved) => addToolApprovalResponse({ id, approved })} />
                      );
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
                        <ScheduleCard key={i} part={part as ComponentProps<typeof ScheduleCard>["part"]} onRespond={(id, approved) => addToolApprovalResponse({ id, approved })} />
                      );
                    }
                    if (part.type === "tool-generate_campaign" && (part as ToolPart).state === "output-available") {
                      const queued = (part as ToolPart).output as { campaignId?: string; count?: number };
                      return queued.campaignId ? <CampaignCard key={i} campaignId={queued.campaignId} count={queued.count ?? 3} /> : null;
                    }
                    const kit = brandOutput(part as ToolPart);
                    if (kit) {
                      return (
                        <div key={i} className="w-full max-w-sm">
                          <BrandCard kit={kit} />
                        </div>
                      );
                    }
                    const products = productsOutput(part as ToolPart);
                    if (products) {
                      return (
                        <div key={i} className="w-full max-w-sm">
                          <ProductsCard products={products} />
                        </div>
                      );
                    }
                    const tool = part as ToolPart;
                    if (tool.type.startsWith("tool-") && tool.state === "output-available" && SITE_TOOL_TYPES.has(tool.type)) {
                      return (
                        <p key={i} className="flex items-center gap-2 text-sm text-cream/80">
                          <CheckCircle2 className="size-4 text-lime" aria-hidden="true" /> {tool.type.replace("tool-", "").replaceAll("_", " ")}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}

            {hasKit && messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPreviewOpen(true);
                  setView("preview");
                }}
                className="ml-11.5 flex items-center gap-4 rounded-xl border border-panel-3 bg-panel-2 p-3 text-left transition hover:border-lime/40"
              >
                <span className="relative grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-panel-3">
                  {overview.products[0]?.imageUrl ? (
                    <Image src={overview.products[0].imageUrl} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <Logo className="size-8" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-cream">{b.artifactTitle.replace("{name}", latestKit?.name ?? storeSlug)}</span>
                  <span className="block text-sm text-stone">{b.artifactBody}</span>
                </span>
                <PanelRightOpen className="size-5 shrink-0 text-stone" aria-label={b.openPreview} />
              </button>
            )}

            {busy && (
              <p className="flex items-center gap-2 pl-11.5 text-sm text-stone">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t.builder.thinking}
              </p>
            )}
            {error && (
              <p role="alert" className="pl-11.5 text-sm text-red-300">
                {t.builder.error}
              </p>
            )}
            <div ref={endRef} />
          </div>

          {(voice.recording || voice.error) && (
            <p role="status" className={`mx-4 rounded-lg px-3 py-2 text-sm ${voice.error ? "bg-red-500/15 text-red-200" : "bg-[#2b3118] text-lime"}`}>
              {voice.error === "denied"
                ? t.builder.micDenied
                : voice.error === "unsupported"
                  ? t.builder.micUnsupported
                  : t.builder.micListening.replace("{seconds}", String(voice.seconds))}
            </p>
          )}
          <div className="p-3">
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={() => send(input)}
              busy={busy}
              recording={voice.recording}
              onMic={voice.recording ? voice.stop : voice.start}
              storeSlug={storeSlug}
              template={templateLabel}
              selectedSection={selectedSection}
              onClearSection={() => setSelectedSection(null)}
            />
          </div>
        </section>

        <aside className={`${view === "preview" ? "flex" : "hidden"} min-h-0 flex-col gap-3 overflow-y-auto lg:flex`}>
          {previewOpen ? (
            <div className="flex h-[62vh] min-h-[420px] shrink-0 flex-col lg:h-[min(560px,58vh)]">
              <PreviewPane
                url={hasKit ? previewUrl : null}
                version={previewVersion}
                presets={presets}
                publishing={busy}
                onSelectSection={selectSection}
                onPublish={publish}
                onClose={() => setPreviewOpen(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-panel-3 text-sm text-cream/80 transition hover:border-lime/40 hover:text-cream"
            >
              <PanelRightOpen className="size-4" aria-hidden="true" /> {b.showPreview}
            </button>
          )}
          <StatusCards overview={{ ...overview, kit: latestKit ?? null }} busy={busy} onPrompt={draft} onPublish={publish} />
        </aside>
      </div>
    </div>
  );
}
