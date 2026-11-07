"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";

const l = t.landing;
const SLIDES = ["/images/auth/baker.jpg", "/images/auth/cook.jpg", "/images/auth/tailor.jpg"];
const INTERVAL_MS = 5000;

/**
 * Sign-up reference: a solid dark card, the photo carousel in an inset rounded panel on the
 * left with the logo over it, and the form on the right. Below lg the photo becomes a banner on top.
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setAutoplay(!query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoplay]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black p-3 font-display sm:p-5">
      <div className="flex w-full max-w-[1080px] flex-col rounded-[28px] bg-panel p-2 lg:h-[min(680px,calc(100dvh-40px))] lg:min-h-[600px] lg:flex-row lg:rounded-[36px] lg:p-2.5">
        <div className="relative h-[40vh] min-h-[300px] shrink-0 overflow-hidden rounded-[22px] lg:h-auto lg:w-[47%] lg:rounded-[28px]">
          {SLIDES.map((src, i) => (
            <Image
              key={src}
              src={src}
              alt={l.slides[i]}
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className={`scale-[1.04] object-cover object-[50%_25%] transition-opacity duration-1000 ease-in-out lg:object-[45%_35%] ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent via-35% to-black/45" />

          <Link href="/" className="absolute top-6 left-6 flex items-center gap-3 text-cream sm:top-8 sm:left-8 lg:top-10 lg:left-10">
            <Logo className="size-9" />
            <span className="text-2xl font-medium tracking-tight drop-shadow">{t.marketing.brand}</span>
          </Link>

          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2 lg:bottom-7">
            {SLIDES.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={l.slide.replace("{n}", String(i + 1)).replace("{total}", String(SLIDES.length))}
                aria-current={i === index}
                className="flex h-6 items-center"
              >
                <span
                  className={`block h-1 rounded-full transition-all ${i === index ? "w-12 bg-lime" : "w-8 bg-white/40 hover:bg-white/70"}`}
                />
              </button>
            ))}
          </div>
        </div>

        <section className="flex flex-1 items-center justify-center px-5 py-9 text-cream sm:px-12 lg:px-12 lg:py-6">
          <div className="w-full max-w-[440px]">
            <h1 className="text-3xl leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
            <p className="mt-2 text-base text-stone">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
