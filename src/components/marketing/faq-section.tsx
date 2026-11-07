"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { t } from "@/lib/messages";
import { CONTAINER, SECTION, SectionHeading } from "./ui";

const f = t.marketing.home.faq;

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <li className="rounded-2xl bg-panel-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-6 px-6 py-6 text-left font-display text-xl font-medium text-cream sm:text-2xl"
      >
        {q}
        {open ? <Minus className="size-6 shrink-0" aria-hidden="true" /> : <Plus className="size-6 shrink-0" aria-hidden="true" />}
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <p className="overflow-hidden px-6 text-base leading-relaxed text-stone sm:text-lg">
          <span className="block pb-6">{a}</span>
        </p>
      </div>
    </li>
  );
}

/** Two independent columns; the first question on the left and the last on the right start open, as in the reference. */
export function FaqSection({ eyebrow = true }: { eyebrow?: boolean }) {
  const [left, setLeft] = useState<number | null>(0);
  const [right, setRight] = useState<number | null>(f.right.length - 1);

  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={eyebrow ? f.eyebrow : undefined} title={f.title} subhead={f.subhead} />
        <div className="mt-16 grid items-start gap-4 md:grid-cols-2">
          <ul className="flex flex-col gap-4">
            {f.left.map((item, i) => (
              <Item key={item.q} {...item} open={left === i} onToggle={() => setLeft(left === i ? null : i)} />
            ))}
          </ul>
          <ul className="flex flex-col gap-4">
            {f.right.map((item, i) => (
              <Item key={item.q} {...item} open={right === i} onToggle={() => setRight(right === i ? null : i)} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
