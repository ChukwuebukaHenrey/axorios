import { Bot, Ellipsis, Megaphone, MessageSquare, Mic, Plug, ShieldCheck, Sparkles, Store } from "lucide-react";
import Image from "next/image";
import { FaqSection } from "@/components/marketing/faq-section";
import { FEATURE_VISUALS } from "@/components/marketing/feature-visuals";
import { GlassFrame, PhotoHero } from "@/components/marketing/hero";
import { CtaBanner, SiteFooter } from "@/components/marketing/site-footer";
import { StatsGrid } from "@/components/marketing/stats-grid";
import { StoriesCarousel } from "@/components/marketing/stories-carousel";
import { CONTAINER, Panel, SECTION, SectionHeading } from "@/components/marketing/ui";
import { t } from "@/lib/messages";

export const metadata = { title: "Feature | AxoriOS" };

const fp = t.marketing.featuresPage;
const CARD_ICONS = [Mic, Store, MessageSquare, Megaphone, Plug, ShieldCheck];
const WORKFLOW_ICONS = [MessageSquare, Sparkles, Bot];
const ROW_BACKGROUNDS = [
  "/images/marketing/usecase-bg.png",
  "/images/marketing/home-bg.png",
  "/images/marketing/features-bg.png",
  "/images/marketing/usecase-bg.png",
];

function WorkflowCard({ index, faded }: { index: number; faded?: boolean }) {
  const card = fp.workflow[index];
  const Icon = WORKFLOW_ICONS[index];
  return (
    <div className={`rounded-2xl bg-[#ecebe6]/90 p-2 text-black shadow-lg ${faded ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 px-1.5 py-1.5">
        <span className="grid size-6 place-items-center rounded-md bg-black text-cream">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <p className="font-display text-base sm:text-lg">{card.title}</p>
        <Ellipsis className="ml-auto size-4 text-black/50" aria-hidden="true" />
      </div>
      {[card.rows, card.rows2].map((rows, r) => (
        <dl key={r} className="mt-1.5 rounded-xl bg-white/85 px-3 py-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-0.5 text-xs sm:text-sm">
              <dt className="text-black/45">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ))}
    </div>
  );
}

export default function FeaturesPage() {
  const rows = fp.rows;
  return (
    <main className="bg-black font-display text-cream">
      <PhotoHero
        background="/images/marketing/features-bg.png"
        headline={fp.headline}
        subhead={fp.subhead}
        cta={fp.cta}
        visual={
          <GlassFrame className="max-w-[780px]">
            <div className="grid gap-3 sm:grid-cols-3">
              {fp.workflow.map((_, i) => (
                <WorkflowCard key={i} index={i} />
              ))}
              {fp.workflow.map((_, i) => (
                <div key={`b${i}`} className="hidden sm:block">
                  <WorkflowCard index={i} faded />
                </div>
              ))}
            </div>
          </GlassFrame>
        }
      />

      <section className={SECTION}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow={fp.capabilities.eyebrow} title={fp.capabilities.title} subhead={fp.capabilities.subhead} />
          <ul className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {fp.capabilities.cards.map((card, i) => {
              const Icon = CARD_ICONS[i];
              return (
                <li key={card.title} className="flex aspect-square flex-col justify-between rounded-3xl bg-[#222] p-6 sm:aspect-auto sm:min-h-[373px]">
                  <Icon className="size-12 text-[#6b6b6b]" strokeWidth={1.8} aria-hidden="true" />
                  <div>
                    <h3 className="font-display text-[28px] leading-tight font-medium tracking-[-0.02em] text-cream">{card.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-stone">{card.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className={SECTION}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow={rows.eyebrow} title={rows.title} subhead={rows.subhead} />
          <ul className="mt-16 flex flex-col gap-5">
            {rows.items.map((item, i) => {
              const Visual = FEATURE_VISUALS[i];
              return (
                <li key={item.title}>
                  <Panel className="grid gap-2 md:grid-cols-2">
                    <div className="flex flex-col justify-between gap-10 p-4 sm:p-6">
                      <div>
                        <h3 className="font-display text-[28px] leading-tight font-medium tracking-[-0.02em] text-cream">{item.title}</h3>
                        <p className="mt-3 text-base leading-relaxed text-stone">{item.body}</p>
                      </div>
                      <ul className="divide-y divide-panel-3">
                        {item.bullets.map((bullet) => (
                          <li key={bullet} className="py-3 text-base text-cream/90">
                            · {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="relative min-h-[360px] overflow-hidden rounded-2xl md:min-h-[514px]">
                      <Image src={ROW_BACKGROUNDS[i]} alt="" fill sizes="(min-width: 768px) 554px, 100vw" className="object-cover" />
                      <div aria-hidden="true" className="absolute inset-0 bg-black/25" />
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full">
                          <Visual />
                        </div>
                      </div>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <StatsGrid />
      <StoriesCarousel />
      <FaqSection eyebrow={false} />
      <CtaBanner />
      <SiteFooter />
    </main>
  );
}
