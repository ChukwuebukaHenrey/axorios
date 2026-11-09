"use client";

import { CalendarClock, ChevronRight, ExternalLink, Megaphone, Package, Plus, RefreshCw, Rocket, ShoppingBag, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import type { BrandKit } from "@/modules/brand";
import type { Product } from "@/modules/catalog";

const c = t.app.cards;

export type BuildOverview = {
  kit: BrandKit | null;
  products: Product[];
  live: boolean;
  liveUrl: string;
  drafts: { count: number; image: string | null };
  scheduled: { count: number; next: string | null };
  shop: { domain: string; lastSyncedAt: string | null } | null;
};

function Card({ icon: Icon, title, href, children }: { icon: typeof Tag; title: string; href?: string; children: ReactNode }) {
  return (
    <article className="flex flex-col rounded-2xl border border-panel-3 bg-panel p-4">
      <header className="flex items-center gap-2.5">
        <Icon className="size-5 shrink-0 text-lime" aria-hidden="true" />
        <h3 className="flex-1 text-lg font-medium text-cream">{title}</h3>
        {href && (
          <Link href={href} aria-label={title} className="grid size-8 place-items-center rounded-md text-stone hover:text-cream">
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </header>
      <div className="mt-3 flex flex-1 flex-col text-sm">{children}</div>
    </article>
  );
}

const ghost = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-panel-3 bg-panel-2 px-3 text-sm text-cream transition hover:border-cream/30";
const primary = "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-lime px-3 text-sm font-semibold text-black transition hover:bg-lime/85 disabled:opacity-50";

export function StatusCards({
  overview,
  busy,
  onPrompt,
  onPublish,
}: {
  overview: BuildOverview;
  busy: boolean;
  onPrompt: (text: string) => void;
  onPublish: () => void;
}) {
  const { kit, products, live, liveUrl, drafts, scheduled, shop } = overview;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card icon={Tag} title={c.brand}>
        {kit ? (
          <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 text-cream">
            <dt className="text-stone">{c.name}</dt>
            <dd className="truncate">{kit.name}</dd>
            <dt className="text-stone">{c.tagline}</dt>
            <dd className="line-clamp-1">{kit.tagline}</dd>
            <dt className="text-stone">{c.palette}</dt>
            <dd className="flex gap-1.5">
              {Object.entries(kit.palette).map(([role, hex]) => (
                <span key={role} title={`${role}: ${hex}`} className="size-6 rounded-md border border-white/15" style={{ background: hex }} />
              ))}
            </dd>
            <dt className="text-stone">{c.fonts}</dt>
            <dd className="truncate">
              {kit.fonts.heading} / {kit.fonts.body}
            </dd>
            <dt className="text-stone">{c.tone}</dt>
            <dd className="line-clamp-1">{kit.tone}</dd>
          </dl>
        ) : (
          <p className="text-stone">{c.brandEmpty}</p>
        )}
      </Card>

      <Card icon={Package} title={c.products.replace("{count}", String(products.length))}>
        {products.length === 0 ? (
          <p className="text-stone">{c.productsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {products.slice(0, 2).map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-panel-3">
                  {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="44px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-cream">{p.name}</span>
                  <span className="block text-stone">{formatMinor(p.priceMinor, p.currency)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-3">
          <button type="button" onClick={() => onPrompt(t.app.build.quickActions[0].prompt)} className={`${ghost} w-full`}>
            <Plus className="size-4" aria-hidden="true" /> {c.addProduct}
          </button>
        </div>
      </Card>

      <Card icon={Rocket} title={c.publish}>
        <p className="text-stone">{live ? c.publishLive : c.publishDraft}</p>
        <div className="mt-auto flex gap-2 pt-3">
          <button type="button" onClick={onPublish} disabled={busy || !kit} className={`${primary} flex-1`}>
            {c.publishButton}
          </button>
          {live && (
            <a href={liveUrl} target="_blank" rel="noreferrer" className={ghost}>
              <ExternalLink className="size-4" aria-hidden="true" /> {c.viewStore}
            </a>
          )}
        </div>
      </Card>

      <Card icon={Megaphone} title={c.campaigns.replace("{count}", String(drafts.count))} href="/dashboard/campaigns">
        {drafts.count === 0 ? (
          <p className="text-stone">{c.campaignsEmpty}</p>
        ) : (
          <div className="flex items-center gap-3">
            <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-panel-3">
              {drafts.image && <Image src={drafts.image} alt="" fill sizes="64px" className="object-cover" />}
            </span>
            <Link href="/dashboard/campaigns" className="text-cream underline underline-offset-4">
              {c.reviewPosts}
            </Link>
          </div>
        )}
        <div className="mt-auto pt-3">
          <button type="button" onClick={() => onPrompt(c.makePostsPrompt)} disabled={!kit} className={`${ghost} w-full`}>
            {c.makePosts}
          </button>
        </div>
      </Card>

      <Card icon={CalendarClock} title={c.schedule} href="/dashboard/campaigns">
        {scheduled.count === 0 || !scheduled.next ? (
          <p className="text-stone">{c.scheduleNone}</p>
        ) : (
          <>
            <p className="text-stone">{c.scheduleCount.replace("{count}", String(scheduled.count))}</p>
            <p className="mt-2 flex items-center gap-2 rounded-lg border border-panel-3 bg-panel-2 px-3 py-2 text-cream" suppressHydrationWarning>
              <CalendarClock className="size-4 text-stone" aria-hidden="true" />
              {new Date(scheduled.next).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </>
        )}
      </Card>

      <Card icon={ShoppingBag} title={c.shopify} href="/dashboard/settings?section=connections">
        <p className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${shop ? "bg-lime/15 text-lime" : "bg-panel-3 text-stone"}`}>
            • {shop ? c.connected : c.notConnected}
          </span>
        </p>
        {shop && (
          <>
            <p className="mt-2 truncate text-cream">{c.syncedTo.replace("{domain}", shop.domain)}</p>
            <p className="text-stone" suppressHydrationWarning>
              {shop.lastSyncedAt
                ? c.lastSync.replace("{time}", new Date(shop.lastSyncedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }))
                : c.neverSynced}
            </p>
          </>
        )}
        <div className="mt-auto pt-3">
          <button type="button" onClick={() => onPrompt(shop ? c.syncPrompt : c.connectPrompt)} disabled={!kit} className={`${ghost} w-full`}>
            {shop && <RefreshCw className="size-4" aria-hidden="true" />}
            {shop ? c.sync : c.connect}
          </button>
        </div>
      </Card>
    </div>
  );
}
