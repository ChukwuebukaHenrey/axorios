import Image from "next/image";
import { t } from "@/lib/messages";
import { CONTAINER, SECTION, SectionHeading } from "./ui";

const s = t.marketing.home.services;

/** A product screen floats on a landscape; a photo fills the card edge to edge. */
type Shot = { src: string; w: number; h: number; bg?: string };
const SHOTS: Shot[] = [
  { bg: "/images/marketing/home-bg.png", src: "/images/marketing/dash-home.webp", w: 1531, h: 815 },
  { src: "/images/marketing/service-payments.webp", w: 1447, h: 1087 },
  { src: "/images/marketing/service-chat.webp", w: 1600, h: 1200 },
  { src: "/images/marketing/service-marketing.webp", w: 1600, h: 1200 },
];

function Shot({ index }: { index: number }) {
  const shot = SHOTS[index];
  if (!shot.bg) {
    return (
      <div className="relative aspect-[532/600] overflow-hidden rounded-3xl">
        <Image src={shot.src} alt={s.imageAlts[index]} fill sizes="(min-width: 1024px) 532px, 100vw" className="object-cover" />
      </div>
    );
  }
  const tall = shot.h > shot.w;
  return (
    <div className="relative aspect-[532/600] overflow-hidden rounded-3xl">
      <Image src={shot.bg} alt="" fill sizes="(min-width: 1024px) 532px, 100vw" className="object-cover" />
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div className={`relative overflow-hidden rounded-xl shadow-2xl shadow-black/40 ${tall ? "h-[88%] w-auto" : "w-full"}`}>
          <Image
            src={shot.src}
            alt={s.imageAlts[index]}
            width={shot.w}
            height={shot.h}
            sizes="(min-width: 1024px) 470px, 90vw"
            className={tall ? "h-full w-auto" : "h-auto w-full"}
          />
        </div>
      </div>
    </div>
  );
}

export function ServicesSection() {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={s.eyebrow} title={s.title} subhead={s.subhead} />

        <div className="mt-16 grid gap-10 sm:mt-32 lg:grid-cols-[532px_1fr] lg:gap-16">
          <div className="hidden flex-col gap-8 lg:flex">
            {SHOTS.map((_, i) => (
              <Shot key={i} index={i} />
            ))}
          </div>

          <ol className="flex flex-col gap-16 self-start lg:sticky lg:top-24">
            {s.items.map((item, i) => (
              <li key={item.title} className="flex gap-6 sm:gap-8">
                <span className="w-11 shrink-0 font-display text-[28px] leading-tight font-semibold text-cream">0{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-6 lg:hidden">
                    <Shot index={i} />
                  </div>
                  <h3 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.02em] text-cream">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-lg leading-relaxed text-stone">{item.body}</p>
                  <ul className="mt-6 grid gap-4">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="text-base text-cream/90">
                        · {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
