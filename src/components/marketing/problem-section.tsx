"use client";

import Image from "next/image";
import { useState } from "react";
import { t } from "@/lib/messages";
import { CONTAINER, SECTION, SectionHeading } from "./ui";

const p = t.marketing.home.problem;

export function ProblemSection() {
  const [open, setOpen] = useState(0);

  return (
    <section className={`${SECTION} overflow-hidden`}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={p.eyebrow} title={p.title} subhead={p.subhead} />

        <div className="mt-16 grid items-start gap-10 lg:grid-cols-[373px_1fr] lg:gap-32">
          <ul className="border-b border-cream/80">
            {p.items.map((item, i) => {
              const active = open === i;
              return (
                <li key={item.title} className="border-t border-cream/80">
                  <button
                    type="button"
                    onClick={() => setOpen(i)}
                    aria-expanded={active}
                    className="w-full py-4 text-left font-display text-[28px] leading-tight font-semibold tracking-[-0.02em] text-cream"
                  >
                    {item.title}
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-300 ${active ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <p className="overflow-hidden text-lg leading-relaxed text-cream/90">
                      <span className="block pb-5">{item.body}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="relative -mr-5 sm:-mr-8 xl:-mr-[calc((100vw-1160px)/2)]">
            <div className="relative overflow-hidden rounded-l-2xl border border-r-0 border-panel-3 bg-panel">
              <Image
                src="/images/tritty/shopify-install.png"
                alt={p.imageAlt}
                width={1600}
                height={900}
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="h-auto w-full"
              />
              <div aria-hidden="true" className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-transparent to-black" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
