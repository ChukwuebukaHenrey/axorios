"use client";

import { Mic, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/messages";
import { CONTAINER, SECTION, SectionHeading } from "./ui";

const p = t.marketing.home.process;
const ICONS = [Mic, ShieldCheck, Wallet];
const R = 385;
const CIRCUMFERENCE = 2 * Math.PI * R;
const TICKS = Array.from({ length: 64 }, (_, i) => i * (360 / 64));

function tick(angle: number) {
  const cardinal = angle % 90 === 0;
  const diagonal = angle % 45 === 0 && !cardinal;
  const inner = cardinal ? 270 : diagonal ? 320 : 340;
  const outer = cardinal ? 370 : diagonal ? 365 : 375;
  const rad = ((angle - 90) * Math.PI) / 180;
  // Rounded so server and browser trig agree to the digit; otherwise hydration fails on the SVG attributes.
  const at = (r: number, f: (x: number) => number) => Math.round((400 + r * f(rad)) * 100) / 100;
  return {
    x1: at(inner, Math.cos),
    y1: at(inner, Math.sin),
    x2: at(outer, Math.cos),
    y2: at(outer, Math.sin),
    major: cardinal || diagonal,
  };
}

export function ProcessDial() {
  const [step, setStep] = useState(0);
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
    const id = setInterval(() => setStep((s) => (s + 1) % p.steps.length), 4500);
    return () => clearInterval(id);
  }, [autoplay]);

  const Icon = ICONS[step];
  const current = p.steps[step];
  const progress = (step + 1) / p.steps.length;

  return (
    <section id="how-it-works" className={`${SECTION} scroll-mt-4 overflow-hidden`}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={p.eyebrow} title={p.title} subhead={p.subhead} />

        <div className="relative mx-auto mt-16 aspect-square w-full max-w-[800px]">
          <div
            aria-hidden="true"
            className="absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,rgb(227_255_72/0.45),rgb(120_150_30/0.2)_55%,transparent)]"
          />
          <svg viewBox="0 0 800 800" aria-hidden="true" className="absolute inset-0 size-full">
            {TICKS.map((angle) => {
              const { major, ...line } = tick(angle);
              return (
                <line
                  key={angle}
                  {...line}
                  stroke="#f5f1e8"
                  strokeOpacity={major ? 0.95 : 0.18}
                  strokeWidth={major ? 3 : 2.5}
                  strokeLinecap="round"
                />
              );
            })}
            <circle
              cx="400"
              cy="400"
              r={R}
              fill="none"
              stroke="#e3ff48"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
              transform="rotate(-90 400 400)"
              className="transition-[stroke-dashoffset] duration-1000 ease-out"
            />
          </svg>

          <div aria-live="polite" className="absolute inset-[22%] flex flex-col items-center justify-center text-center">
            <Icon className="size-14 text-cream sm:size-24" strokeWidth={1.6} aria-hidden="true" />
            <p className="mt-6 font-display text-xl font-semibold tracking-tight text-cream sm:mt-10 sm:text-4xl">
              {step + 1}. {current.title}
            </p>
            <p className="mt-3 max-w-[465px] text-xs leading-relaxed text-cream/80 sm:mt-5 sm:text-lg">{current.body}</p>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {p.steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`${i + 1}. ${s.title}`}
              aria-current={i === step}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-lime" : "w-1.5 bg-cream/30 hover:bg-cream/60"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
