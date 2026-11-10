"use client";

import { LayoutGroup, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedItem = { value: string; label: ReactNode; href?: string; count?: number };

type Props = {
  items: SegmentedItem[];
  value: string;
  /** For button tabs. Link tabs (with `href`) navigate and need no handler. */
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  label: string;
  className?: string;
  /** `light` for white surfaces (the marketing nav on photo heroes). */
  tone?: "dark" | "light";
  /** Link tabs keep the scroll position by default (workspace sub-tabs); page navigation passes false. */
  keepScroll?: boolean;
};

const TONES = {
  dark: {
    strip: "border-panel-3 bg-panel",
    pill: "border-white/[0.06] bg-panel-3 shadow-[0_1px_2px_rgb(0_0_0/0.4)]",
    on: "text-cream",
    off: "text-stone hover:bg-white/[0.03] hover:text-cream",
    count: ["bg-lime/15 text-lime", "bg-panel-2 text-stone"],
  },
  light: {
    strip: "border-black/[0.08] bg-black/[0.04]",
    pill: "border-black/[0.06] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.12)]",
    on: "text-black",
    off: "text-black/60 hover:bg-black/[0.04] hover:text-black",
    count: ["bg-black/10 text-black", "bg-black/[0.06] text-black/60"],
  },
} as const;

/**
 * The one tab strip used across the workspace: the whole active tab gets a raised background
 * that slides to the newly chosen tab (Motion shared layout). It moves on click, before the
 * server answers, so a slow navigation still feels registered. Honors reduced motion.
 */
export function Segmented({ items, value, onChange, size = "md", label, className, tone = "dark", keepScroll = true }: Props) {
  const c = TONES[tone];
  const id = useId();
  const [active, setActive] = useState(value);
  // The server's answer wins once it arrives (adjusting state from props, without an effect).
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setActive(value);
  }

  const pick = (v: string) => {
    setActive(v);
    onChange?.(v);
  };

  const item = cn(
    "relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap outline-none transition-colors",
    "focus-visible:ring-2 focus-visible:ring-lime/60",
    size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
  );

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={id}>
        <nav
          aria-label={label}
          className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border p-0.5 [scrollbar-width:none]", c.strip, className)}
        >
          {items.map((it) => {
            const on = it.value === active;
            const inner = (
              <>
                {on && (
                  <motion.span
                    layoutId="seg-active"
                    className={cn("absolute inset-0 rounded-md border", c.pill)}
                    transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10">{it.label}</span>
                {it.count != null && it.count > 0 && (
                  <span className={cn("relative z-10 rounded px-1 text-[11px] tabular-nums", on ? c.count[0] : c.count[1])}>{it.count}</span>
                )}
              </>
            );
            const cls = cn(item, on ? c.on : c.off);
            return it.href ? (
              <Link key={it.value} href={it.href} scroll={!keepScroll} aria-current={on ? "page" : undefined} onClick={() => pick(it.value)} className={cls}>
                {inner}
              </Link>
            ) : (
              <button key={it.value} type="button" aria-pressed={on} onClick={() => pick(it.value)} className={cls}>
                {inner}
              </button>
            );
          })}
        </nav>
      </LayoutGroup>
    </MotionConfig>
  );
}
