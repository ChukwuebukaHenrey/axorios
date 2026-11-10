import Image from "next/image";
import { t } from "@/lib/messages";
import { CONTAINER, SECTION, SectionHeading, Sparkle } from "./ui";

const s = t.marketing.home.stats;

/** `focus` is the object-position that keeps the subject in frame on the tall card (the photos are landscape). */
function StatCard({ value, label, detail, image, focus = "50% 50%" }: { value: string; label: string; detail: string; image?: string; focus?: string }) {
  return (
    <div className="relative isolate flex h-[380px] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-b from-[#121212] to-[#1c1c1c] p-6 sm:h-[450px]">
      {image ? (
        <>
          <Image src={image} alt="" fill sizes="(min-width: 1024px) 373px, 100vw" className="-z-10 object-cover" style={{ objectPosition: focus }} />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/10 to-black/75" />
        </>
      ) : (
        <Sparkle className="absolute top-1/2 left-1/2 -z-10 size-[95%] -translate-x-1/2 -translate-y-1/2 text-white/[0.06]" />
      )}
      <p className="font-display text-[52px] leading-none font-medium tracking-tight text-cream">{value}</p>
      <div>
        <p className="font-display text-[28px] leading-tight font-medium tracking-[-0.02em] text-cream">{label}</p>
        <p className="mt-3 text-base text-stone">{detail}</p>
      </div>
    </div>
  );
}

export function StatsGrid() {
  const [first, second, third, fourth] = s.items;
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={s.eyebrow} title={s.title} subhead={s.subhead} />
        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          <div className="relative isolate flex min-h-[380px] flex-col justify-end overflow-hidden rounded-3xl p-6 sm:min-h-[450px] lg:col-span-2">
            <Image src="/images/marketing/features-bg.png" alt="" fill sizes="(min-width: 1024px) 767px, 100vw" className="-z-10 object-cover" />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
            <h3 className="font-display text-4xl font-medium tracking-[-0.02em] text-cream">{s.blueprintTitle}</h3>
            <p className="mt-4 text-lg leading-relaxed text-cream sm:text-2xl sm:leading-relaxed">{s.blueprintBody}</p>
          </div>
          <StatCard {...first} />
          <StatCard {...third} image="/images/marketing/stat-approvals.webp" focus="80% 50%" />
          <StatCard {...second} image="/images/marketing/stat-voice.webp" focus="62% 50%" />
          <StatCard {...fourth} image="/images/marketing/stat-currency.webp" focus="78% 50%" />
        </div>
      </div>
    </section>
  );
}
