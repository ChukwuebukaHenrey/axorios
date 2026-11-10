import { Check } from "lucide-react";
import Image from "next/image";
import { FaqSection } from "@/components/marketing/faq-section";
import { GlassFrame, PhotoHero } from "@/components/marketing/hero";
import { CtaBanner, SiteFooter } from "@/components/marketing/site-footer";
import { StatsGrid } from "@/components/marketing/stats-grid";
import { CONTAINER, SECTION, SectionHeading } from "@/components/marketing/ui";
import { t } from "@/lib/messages";

export const metadata = { title: "Use Case | AxoriOS" };

const u = t.marketing.useCasePage;
/** Storefront shows the product itself (a screenshot on the light panel); the others are photos that fill it. */
const SHOTS: { src: string; w: number; h: number; photo?: boolean }[] = [
  { src: "/images/marketing/dash-store.webp", w: 1528, h: 811 },
  { src: "/images/marketing/usecase-sales.webp", w: 1448, h: 1086, photo: true },
  { src: "/images/marketing/service-payments.webp", w: 1447, h: 1087, photo: true },
  { src: "/images/marketing/usecase-marketing.webp", w: 1600, h: 1174, photo: true },
];

/** The reference's "barcode" meter under each stat: decorative, the last one lit lime. */
function Meter({ lit }: { lit: boolean }) {
  return (
    <div aria-hidden="true" className="mt-4 flex h-10 gap-[3px]">
      {Array.from({ length: 24 }, (_, i) => (
        <span key={i} className={`w-[2px] flex-1 ${lit ? "bg-lime" : i > 18 ? "bg-panel" : "bg-cream/55"}`} />
      ))}
    </div>
  );
}

export default function UseCasePage() {
  const s = u.section;
  return (
    <main className="bg-black font-display text-cream">
      <PhotoHero
        background="/images/marketing/usecase-bg.png"
        headline={u.headline}
        subhead={u.subhead}
        cta={u.cta}
        ctaHref="/s/demo"
        visual={
          <GlassFrame className="max-w-[760px]">
            <Image
              src="/images/marketing/usecase-card.png"
              alt={u.cardAlt}
              width={1448}
              height={1086}
              priority
              sizes="(min-width: 768px) 760px, 100vw"
              className="h-auto w-full"
            />
          </GlassFrame>
        }
      />

      <section className={SECTION}>
        <div className={CONTAINER}>
          <SectionHeading eyebrow={s.eyebrow} title={s.title} subhead={s.subhead} />
          <ul className="mt-16 flex flex-col gap-8">
            {s.items.map((item, i) => {
              const shot = SHOTS[i];
              const tall = shot.h > shot.w;
              return (
                <li key={item.label} className="grid gap-3 rounded-[28px] bg-panel-2 p-3 lg:grid-cols-[480px_1fr]">
                  <div className="flex flex-col p-5">
                    <p className="font-mono text-base text-stone">{item.label}</p>
                    <h3 className="mt-5 font-display text-[28px] leading-tight font-medium tracking-[-0.02em] text-cream">{item.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-stone">{item.body}</p>
                    <p className="mt-8 text-base text-stone">{s.handles}</p>
                    <ul className="mt-4 flex flex-col gap-3">
                      {item.checks.map((check) => (
                        <li key={check} className="flex items-center gap-3 text-sm text-cream">
                          <Check className="size-4 shrink-0" aria-hidden="true" />
                          {check}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-10 grid grid-cols-3 gap-4">
                      {item.stats.map(([value, label], j) => (
                        <div key={label}>
                          <p className="font-display text-[28px] leading-none font-medium text-cream">{value}</p>
                          <p className="mt-3 text-sm text-stone">{label}</p>
                          <Meter lit={j === 2} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="relative min-h-[320px] overflow-hidden rounded-2xl bg-[#ecebe6] lg:min-h-[483px]">
                    {shot.photo ? (
                      <Image src={shot.src} alt={item.imageAlt} fill sizes="(min-width: 1024px) 624px, 100vw" className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                        <Image
                          src={shot.src}
                          alt={item.imageAlt}
                          width={shot.w}
                          height={shot.h}
                          sizes="(min-width: 1024px) 624px, 100vw"
                          className={`rounded-lg shadow-lg ${tall ? "h-full w-auto" : "h-auto w-full"}`}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <StatsGrid />
      <FaqSection eyebrow={false} />
      <CtaBanner />
      <SiteFooter />
    </main>
  );
}
