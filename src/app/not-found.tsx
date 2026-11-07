import Image from "next/image";
import { SiteNav } from "@/components/marketing/site-nav";
import { Button } from "@/components/marketing/ui";
import { t } from "@/lib/messages";

const n = t.marketing.notFound;

/** The reference's 404: the landscape in monochrome halftone, one way back. */
export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-black font-display text-cream">
      <Image src="/images/marketing/home-bg.png" alt="" fill priority sizes="100vw" className="-z-30 object-cover object-bottom brightness-[0.45] contrast-125 grayscale" />
      <div aria-hidden="true" className="halftone absolute inset-0 -z-20" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-black/30 via-transparent to-black" />
      <SiteNav theme="dark" />
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-32 text-center">
        <h1 className="font-display text-[clamp(6rem,18vw,11rem)] leading-none font-semibold tracking-[-0.04em] text-cream">{n.title}</h1>
        <p className="mt-8 max-w-[560px] text-lg leading-relaxed text-cream/70">{n.body}</p>
        <Button href="/" variant="cream" className="mt-10 h-14 px-8 text-lg">
          {n.cta}
        </Button>
      </div>
    </main>
  );
}
