"use client";

import { ShoppingBag, Sparkles } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { t } from "@/lib/messages";
import { Button, CONTAINER, SECTION, SectionHeading } from "./ui";

const c = t.marketing.integrationsPage.all;
type Tab = keyof typeof c.tabs;
const TABS = Object.keys(c.tabs) as Tab[];
const ICON_SRC: Record<string, string> = {
  paypal: "/images/icons/paypal.png",
  telegram: "/images/icons/telegram.png",
  whatsapp: "/images/icons/whatsapp.png",
  supabase: "/images/icons/supabase.png",
};

function Icon({ id, title }: { id: string; title: string }) {
  const src = ICON_SRC[id];
  if (src) return <Image src={src} alt={title} width={40} height={40} className="size-9 object-contain" />;
  // No Shopify or Gemini mark in the asset set: neutral glyphs hold their place.
  const Glyph = id === "shopify" ? ShoppingBag : Sparkles;
  return <Glyph className="size-7 text-cream" aria-label={title} />;
}

export function IntegrationCatalog() {
  const [tab, setTab] = useState<Tab>("all");
  const items = c.items.filter((item) => tab === "all" || item.category === tab);

  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={c.eyebrow} title={c.title} subhead={c.subhead} />

        <div className="mx-auto mt-16 flex w-fit max-w-full overflow-x-auto rounded-lg bg-panel-3 p-1">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`h-9 shrink-0 rounded-md px-4 font-display text-base transition sm:px-5 ${
                tab === key ? "bg-black text-cream" : "text-cream/75 hover:text-cream"
              }`}
            >
              {c.tabs[key]}
            </button>
          ))}
        </div>

        <ul className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const off = item.id === "whatsapp";
            return (
              <li key={item.id} className="flex min-h-[246px] flex-col rounded-3xl bg-[#222] p-6">
                <div className="flex items-start justify-between">
                  <span className="grid size-14 place-items-center rounded-xl bg-panel-3">
                    <Icon id={item.id} title={item.title} />
                  </span>
                  {off ? (
                    <span className="inline-flex h-11 items-center rounded-lg bg-panel-3 px-4 font-mono text-sm text-stone">{c.off}</span>
                  ) : (
                    <Button href="/sign-up" variant="muted">
                      {c.connect}
                    </Button>
                  )}
                </div>
                <p className="mt-10 font-mono text-sm text-stone">{c.tabs[item.category as Tab]}</p>
                <h3 className="mt-2 font-display text-[28px] leading-tight font-medium tracking-[-0.02em] text-cream">{item.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-stone">{item.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
