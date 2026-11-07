"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { t } from "@/lib/messages";
import { Button, CONTAINER, SectionHeading } from "./ui";

const p = t.marketing.pricing;
const ISSUES_URL = "https://github.com/ChukwuebukaHenrey/axorios/issues";

/** Pricing: hosted vs self-hosted toggle and three plans, the middle one highlighted as in the reference. */
export function PricingCards({ className = "py-20 sm:py-28 lg:py-[120px]" }: { className?: string }) {
  const [selfHosted, setSelfHosted] = useState(false);

  return (
    <section className={className}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={p.eyebrow} title={p.title} subhead={p.subhead} />

        <div role="group" className="mx-auto mt-16 flex w-fit rounded-lg bg-panel-3 p-1">
          {[p.toggleHosted, p.toggleSelf].map((label, i) => {
            const active = selfHosted === (i === 1);
            return (
              <button
                key={label}
                type="button"
                onClick={() => setSelfHosted(i === 1)}
                aria-pressed={active}
                className={`h-9 rounded-md px-6 font-display text-base transition ${active ? "bg-black text-cream" : "text-cream/75 hover:text-cream"}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <ul className="mt-16 grid gap-5 lg:grid-cols-3">
          {p.plans.map((plan, i) => {
            const featured = i === 1;
            const price = selfHosted ? plan.priceSelf : plan.priceHosted;
            const period = selfHosted ? plan.periodSelf : plan.periodHosted;
            return (
              <li
                key={plan.name}
                className={`flex flex-col rounded-3xl px-5 pt-10 pb-8 text-center ${featured ? "bg-[#232323]" : "bg-[#141414]"}`}
              >
                <h3 className="font-display text-[28px] font-semibold text-cream">{plan.name}</h3>
                <p className="mx-auto mt-3 max-w-[333px] text-sm leading-relaxed text-stone">{plan.body}</p>
                <p className="mt-12 flex items-baseline justify-center gap-1">
                  <span className="font-display text-6xl leading-none font-medium tracking-tight text-cream">{price}</span>
                  {period && <span className="text-sm text-stone">{period}</span>}
                </p>
                <Button
                  href={i === 2 ? ISSUES_URL : "/sign-up"}
                  external={i === 2}
                  variant={featured ? "lime" : "muted"}
                  className="mt-8 w-full"
                >
                  {plan.cta}
                </Button>
                <ul className="mt-12 flex flex-col gap-4 text-left">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-base text-cream">
                      <Check className="size-5 shrink-0" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
