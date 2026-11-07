import { Mic } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { SiteNav } from "./site-nav";
import { Button } from "./ui";

/**
 * The reference hero: a landscape photo, dark type, one CTA, and a product visual rising from the bottom edge.
 * Nav, headline and CTA fit one viewport (100dvh); the visual is cropped by the fold and fades into the black page.
 */
export function PhotoHero({
  background,
  headline,
  subhead,
  cta,
  ctaHref = "/sign-up",
  visual,
}: {
  background: string;
  headline: string;
  subhead: string;
  cta: string;
  ctaHref?: string;
  visual: ReactNode;
}) {
  return (
    <section className="relative isolate flex h-dvh min-h-[680px] flex-col overflow-hidden bg-black">
      <Image src={background} alt="" fill priority sizes="100vw" className="-z-20 object-cover object-bottom" />
      <SiteNav theme="light" />

      <div className="mx-auto flex w-full max-w-[1160px] flex-col items-center px-5 pt-10 text-center sm:px-8 sm:pt-14 lg:pt-20 xl:px-0">
        <h1 className="max-w-[1100px] font-display text-[clamp(2.4rem,6.2vw,5.4rem)] leading-[0.98] font-semibold tracking-[-0.045em] text-balance text-black">
          {headline}
        </h1>
        <p className="mt-6 max-w-[720px] text-base leading-relaxed text-black/65 text-balance sm:text-xl">{subhead}</p>
        <Button href={ctaHref} variant="black" className="mt-8 h-12 px-6 text-base">
          <Mic className="size-5" aria-hidden="true" />
          {cta}
        </Button>
      </div>

      <div className="relative mt-10 flex-1 sm:mt-14">
        <div className="absolute inset-x-0 top-0 mx-auto w-full max-w-[1160px] px-5 sm:px-8 xl:px-0">{visual}</div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent via-black/60 to-black"
        />
      </div>
    </section>
  );
}

/** The frosted frame that holds hero visuals in the reference. */
export function GlassFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mx-auto rounded-[28px] border border-white/25 bg-white/15 p-3 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-4 ${className}`}
    >
      {children}
    </div>
  );
}
