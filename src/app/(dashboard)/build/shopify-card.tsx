"use client";

import { ExternalLink, Loader2, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/messages";
import type { SyncResult } from "@/modules/platforms";
import { shopifySyncResult } from "./actions";

type ShopifyPart = {
  state?: string;
  input?: { shopDomain?: string };
  output?: { error?: string; shopName?: string; queued?: boolean };
  approval?: { id: string; isAutomatic?: boolean };
};

const shell = "my-2 w-full max-w-sm rounded-2xl border border-panel-3 bg-panel-2 p-4 text-cream";

export function ThemeHandoffList({ theme }: { theme: NonNullable<SyncResult["theme"]> }) {
  return (
    <div className="mt-3 text-sm">
      <p className="text-stone">{t.shopifyCard.themeIntro}</p>
      <p className="mt-2 font-semibold">{t.shopifyCard.colours}</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {Object.entries(theme.palette).map(([name, hex]) => (
          <li key={name} className="flex items-center gap-1.5">
            <span className="size-4 rounded border border-cream/20" style={{ background: hex }} aria-hidden="true" />
            <code>{hex}</code>
          </li>
        ))}
      </ul>
      <p className="mt-2">
        <span className="font-semibold">{t.shopifyCard.fonts}:</span> {theme.fonts.heading}, {theme.fonts.body}
      </p>
      <a href={theme.editorUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-lime underline">
        {t.shopifyCard.themeLink} <ExternalLink className="size-4" aria-hidden="true" />
      </a>
    </div>
  );
}

/** Waits for the job started when this card was approved, by looking for a result newer than the card. */
function SyncProgress() {
  const [startedAt] = useState(() => Date.now());
  const [result, setResult] = useState<SyncResult | null>(null);
  const finished = Boolean(result && new Date(result.at).getTime() >= startedAt - 5000);

  useEffect(() => {
    if (finished) return;
    let active = true;
    const load = () =>
      shopifySyncResult()
        .then((next) => active && setResult(next))
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [finished]);

  if (!finished || !result) {
    return (
      <p className={`${shell} flex items-center gap-2 text-sm`}>
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {t.shopifyCard.syncing}
      </p>
    );
  }
  if (result.error) return <p className={`${shell} text-sm text-red-800`}>{t.shopifyCard.failed}</p>;
  return (
    <article className={shell}>
      <h3 className="font-semibold">
        {t.shopifyCard.synced.replace("{products}", String(result.products ?? 0)).replace("{pages}", String(result.pages ?? 0))}
      </h3>
      {result.theme && <ThemeHandoffList theme={result.theme} />}
    </article>
  );
}

/** Nothing reaches Shopify from the model's word alone: connect and sync both wait here for the seller's answer. */
export function ShopifyCard({
  kind,
  part,
  onRespond,
}: {
  kind: "connect" | "sync";
  part: ShopifyPart;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  if (part.state === "approval-requested" && part.approval && !part.approval.isAutomatic) {
    const { id } = part.approval;
    return (
      <article className={shell}>
        <h3 className="flex items-center gap-2 font-semibold">
          <ShoppingBag className="size-5 text-secondary" aria-hidden="true" />
          {kind === "connect" ? t.shopifyCard.connectTitle : t.shopifyCard.syncTitle}
        </h3>
        <p className="mt-1 text-sm break-words text-stone">
          {kind === "connect" ? t.shopifyCard.connectBody.replace("{domain}", part.input?.shopDomain ?? "") : t.shopifyCard.syncBody}
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onRespond(id, true)} className="h-11 flex-1 rounded-lg bg-lime font-semibold text-black transition hover:bg-lime/85">
            {t.shopifyCard.approve}
          </button>
          <button type="button" onClick={() => onRespond(id, false)} className="h-11 flex-1 rounded-lg border border-cream/20 font-semibold transition hover:bg-white/5">
            {t.shopifyCard.deny}
          </button>
        </div>
      </article>
    );
  }
  if (part.state === "output-denied") return <p className="my-2 text-sm text-stone">{t.shopifyCard.denied}</p>;
  if (part.state !== "output-available") return null;
  if (part.output?.error) return <p className="my-2 text-sm text-stone">{t.shopifyCard.refused}</p>;
  if (kind === "connect") return <p className="my-2 text-sm font-medium">{t.shopifyCard.connected.replace("{shop}", part.output?.shopName ?? "")}</p>;
  return <SyncProgress />;
}
