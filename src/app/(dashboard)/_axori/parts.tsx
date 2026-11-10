"use client";

import type { UIMessage } from "ai";
import { CheckCircle2, Mic, ShieldCheck } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { t } from "@/lib/messages";
import { requiresApproval } from "@/modules/agent/approvals";
import type { BrandKit } from "@/modules/brand";
import type { Product } from "@/modules/catalog";
import { BrandCard } from "./cards/brand-card";
import { CampaignCard } from "./cards/campaign-card";
import { ProductsCard } from "./cards/products-card";
import { PublishCard } from "./cards/publish-card";
import { ScheduleCard } from "./cards/schedule-card";
import { ShopifyCard } from "./cards/shopify-card";
import { RefundToolSummary } from "../dashboard/orders/refund-card";
import { ZapierSummary } from "./zapier-card";

const a = t.app.axori;

export type ToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approval?: { id: string; isAutomatic?: boolean; approved?: boolean };
};

type Handlers = {
  onRespond: (approvalId: string, approved: boolean) => void;
  onChoose: (text: string) => void;
  /** Extra renderers for tools a page owns (the refund card, the new-store card). Return null to fall through. */
  renderTool?: (part: ToolPart, handlers: Handlers) => ReactNode | null;
  busy: boolean;
};

const BRAND_TOOLS = new Set(["tool-create_brand_kit", "tool-update_brand_kit", "tool-suggest_names"]);
const DONE_TOOLS = new Set(["tool-add_products", "tool-edit_site", "tool-revert_site", "tool-choose_template", "tool-update_brand_kit"]);

/** Any approval-gated tool without its own card gets this one: what will happen, Approve and Cancel. */
export function ApprovalCard({ part, title, children, onRespond }: { part: ToolPart; title: string; children?: ReactNode; onRespond: Handlers["onRespond"] }) {
  const shell = "my-1 w-full max-w-md rounded-2xl border border-lime/25 bg-panel-2 p-4 text-cream";
  if (part.state === "approval-requested" && part.approval && !part.approval.isAutomatic) {
    const { id } = part.approval;
    return (
      <article className={shell}>
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-lime uppercase">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> {a.approval.title}
        </p>
        <h3 className="mt-1.5 font-semibold">{title}</h3>
        {children && <div className="mt-2 text-sm text-cream/85">{children}</div>}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onRespond(id, true)} className="h-10 flex-1 rounded-lg bg-lime font-semibold text-black transition hover:bg-lime/85">
            {a.approval.approve}
          </button>
          <button type="button" onClick={() => onRespond(id, false)} className="h-10 flex-1 rounded-lg border border-cream/20 font-semibold transition hover:bg-white/5">
            {a.approval.cancel}
          </button>
        </div>
      </article>
    );
  }
  if (part.state === "output-denied") return <p className="text-sm text-stone">{a.approval.cancelled}</p>;
  if (part.state === "output-error") return <p className="text-sm text-red-300">{a.approval.failed.replace("{error}", part.errorText ?? "")}</p>;
  if (part.state === "approval-responded" || part.state === "input-available") return <p className="text-sm text-stone">{a.approval.running}</p>;
  if (part.state === "output-available") {
    const error = (part.output as { error?: string } | null)?.error;
    return error ? (
      <p className="text-sm text-red-300">{a.approval.failed.replace("{error}", error.replaceAll("_", " "))}</p>
    ) : (
      <article className={shell}>
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-4 text-lime" aria-hidden="true" /> {title} · {a.approval.approved}
        </p>
        {children && <div className="mt-2 text-sm text-cream/85">{children}</div>}
      </article>
    );
  }
  return null;
}

/** The tool's own input, as plain key/value lines. Values are the model's proposal; the server re-checks everything. */
/**
 * A tool that normally runs straight away but the seller set to Needs approval in Settings (6.12):
 * the generic card while it waits, then the tool's usual output once it has run.
 */
export function StricterApprovalCard({ part, onRespond }: { part: ToolPart; onRespond: Handlers["onRespond"] }) {
  const name = part.type.replace(/^tool-/, "");
  if (!part.type.startsWith("tool-") || requiresApproval(name) || !part.approval || part.approval.isAutomatic) return null;
  if (part.state === "output-available") return null;
  const title = (a.approval.tools as Record<string, string>)[name] ?? name.replaceAll("_", " ");
  return (
    <ApprovalCard part={part} title={title} onRespond={onRespond}>
      <InputLines input={part.input} />
    </ApprovalCard>
  );
}

function InputLines({ input }: { input: unknown }) {
  const entries = Object.entries((input as Record<string, unknown>) ?? {}).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-stone">{k}</dt>
          <dd className="[overflow-wrap:anywhere]">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MessageParts({ message, handlers }: { message: UIMessage; handlers: Handlers }) {
  const { onRespond, onChoose, renderTool, busy } = handlers;
  return (
    <>
      {message.parts.map((raw, i) => {
        const part = raw as ToolPart & { text?: string };
        if (part.type === "text") {
          return message.role === "user" ? (
            <p key={i} className="self-end rounded-2xl rounded-br-md bg-panel-3 px-4 py-2.5 whitespace-pre-wrap text-cream [overflow-wrap:anywhere]">
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
            <p key={i} className="flex items-center gap-2 self-end rounded-2xl rounded-br-md bg-panel-3 px-4 py-2.5 text-cream">
              <Mic className="size-4 text-lime" aria-hidden="true" /> {t.builder.voiceNote}
            </p>
          );
        }
        const custom = renderTool?.(part, handlers);
        if (custom) return <div key={i}>{custom}</div>;

        if (part.type === "tool-show_transcript") {
          const said = (part.input as { transcript?: string } | undefined)?.transcript;
          return said ? (
            <p key={i} className="rounded-xl border border-panel-3 bg-panel-2 px-3 py-2 text-sm text-cream/90">
              <span className="font-semibold text-cream">{t.builder.youSaid}</span> “{said}”
            </p>
          ) : null;
        }
        if (part.type === "tool-offer_choices") {
          const input = part.input as { question?: string; options?: string[] } | undefined;
          if (!input?.options) return null;
          return (
            <div key={i} className="flex flex-col gap-2">
              {input.question && <p className="text-cream/90">{input.question}</p>}
              <div className="flex flex-wrap gap-2">
                {input.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={busy}
                    onClick={() => onChoose(option)}
                    className="rounded-full border border-lime/30 bg-[#2b3118] px-3.5 py-1.5 text-sm text-lime transition hover:border-lime/60 disabled:opacity-50"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        if (part.type === "tool-publish_store") return <PublishCard key={i} part={part as ComponentProps<typeof PublishCard>["part"]} onRespond={onRespond} />;
        if (part.type === "tool-connect_shopify" || part.type === "tool-sync_to_shopify") {
          return (
            <ShopifyCard
              key={i}
              kind={part.type === "tool-connect_shopify" ? "connect" : "sync"}
              part={part as ComponentProps<typeof ShopifyCard>["part"]}
              onRespond={onRespond}
            />
          );
        }
        if (part.type === "tool-schedule_posts") return <ScheduleCard key={i} part={part as ComponentProps<typeof ScheduleCard>["part"]} onRespond={onRespond} />;
        const stricter = StricterApprovalCard({ part, onRespond });
        if (stricter) return <div key={i}>{stricter}</div>;
        if (part.type === "tool-generate_campaign" && part.state === "output-available") {
          const queued = part.output as { campaignId?: string; count?: number };
          return queued.campaignId ? <CampaignCard key={i} campaignId={queued.campaignId} count={queued.count ?? 3} /> : null;
        }
        if (BRAND_TOOLS.has(part.type) && part.state === "output-available") {
          return (
            <div key={i} className="w-full max-w-sm">
              <BrandCard kit={part.output as BrandKit} />
            </div>
          );
        }
        if (part.type === "tool-add_products" && part.state === "output-available") {
          return (
            <div key={i} className="w-full max-w-sm">
              <ProductsCard products={part.output as Product[]} />
            </div>
          );
        }
        if (part.type === "tool-refund_order") {
          return (
            <ApprovalCard key={i} part={part} title={(a.approval.tools as Record<string, string>).refund_order ?? t.app.refund.title} onRespond={onRespond}>
              <RefundToolSummary input={part.input} output={part.output} waiting={part.state === "approval-requested"} />
            </ApprovalCard>
          );
        }
        if (part.type === "tool-zapier_action") {
          // A Zapier failure shows its own plain reason, not the generic "That didn't work".
          if (part.state === "output-available" && (part.output as { error?: string } | null)?.error) {
            return (
              <div key={i} className="text-sm">
                <ZapierSummary input={part.input} output={part.output} waiting={false} />
              </div>
            );
          }
          return (
            <ApprovalCard key={i} part={part} title={t.app.zapier.title} onRespond={onRespond}>
              <ZapierSummary input={part.input} output={part.output} waiting={part.state === "approval-requested"} />
            </ApprovalCard>
          );
        }
        const name = part.type.replace(/^tool-/, "");
        if (part.type.startsWith("tool-") && requiresApproval(name)) {
          const title = (a.approval.tools as Record<string, string>)[name] ?? name.replaceAll("_", " ");
          return (
            <ApprovalCard key={i} part={part} title={title} onRespond={onRespond}>
              <InputLines input={part.input} />
            </ApprovalCard>
          );
        }
        if (DONE_TOOLS.has(part.type) && part.state === "output-available") {
          return (
            <p key={i} className="flex items-center gap-2 text-sm text-cream/80">
              <CheckCircle2 className="size-4 text-lime" aria-hidden="true" /> {name.replaceAll("_", " ")}
            </p>
          );
        }
        return null;
      })}
    </>
  );
}
