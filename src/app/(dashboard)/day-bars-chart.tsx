"use client";

import { useState, type KeyboardEvent } from "react";
import { t } from "@/lib/messages";
import { cn } from "@/lib/utils";

export type DayPoint = { day: string; value: number; date: string; text: string; share: string };

const c = t.app.charts;

/**
 * Daily bars with a real tooltip: hover, tap or arrow keys show the date, the value and its share of
 * the period. A dashed line marks the daily average. Plain SVG, no chart library on these pages.
 */
export function DayBarsChart({ points, label, total, average, peak, height = 176 }: { points: DayPoint[]; label: string; total: string; average: string; peak: string | null; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const avg = points.length ? points.reduce((s, p) => s + p.value, 0) / points.length : 0;
  const w = 100 / Math.max(1, points.length);
  const gap = points.length > 60 ? 0.12 : points.length > 20 ? 0.25 : 0.6;
  const shown = active === null ? null : points[active];
  const left = active === null ? 0 : (active + 0.5) * w;

  const onKey = (e: KeyboardEvent) => {
    if (!points.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      setActive((i) => Math.min(points.length - 1, Math.max(0, (i ?? (step > 0 ? -1 : points.length)) + step)));
    }
    if (e.key === "Escape") setActive(null);
  };

  return (
    <figure className="w-full">
      <dl className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-stone">{c.total}</dt>
          <dd className="font-mono text-cream tabular-nums">{total}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-stone">{c.average}</dt>
          <dd className="font-mono text-cream tabular-nums">{average}</dd>
        </div>
        {peak && (
          <div className="flex gap-1.5">
            <dt className="text-stone">{c.peak}</dt>
            <dd className="font-mono text-cream tabular-nums">{peak}</dd>
          </div>
        )}
      </dl>
      <div
        role="img"
        aria-label={`${label}. ${c.keys}`}
        tabIndex={0}
        onKeyDown={onKey}
        onMouseLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
        style={{ height }}
      >
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2="100" y1={40 - f * 38} y2={40 - f * 38} className="stroke-panel-3/60" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" x2="100" y1="40" y2="40" className="stroke-panel-3" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          {avg > 0 && (
            <line x1="0" x2="100" y1={40 - (avg / max) * 38} y2={40 - (avg / max) * 38} className="stroke-cream/35" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          )}
          {points.map((p, i) => {
            const h = (p.value / max) * 38;
            const on = active === i;
            return (
              <g key={p.day}>
                {on && <rect x={i * w} y="0" width={w} height="40" className="fill-cream/[0.04]" />}
                <rect
                  x={i * w + gap}
                  y={40 - Math.max(h, p.value > 0 ? 0.6 : 0)}
                  width={Math.max(0.2, w - gap * 2)}
                  height={Math.max(h, p.value > 0 ? 0.6 : 0)}
                  rx={Math.min(0.5, (w - gap * 2) / 3)}
                  className={cn("transition-[fill] duration-100", active === null ? "fill-lime/80" : on ? "fill-lime" : "fill-lime/30")}
                />
                <rect x={i * w} y="0" width={w} height="40" fill="transparent" onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} />
              </g>
            );
          })}
        </svg>
        {shown && (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 z-10 w-max min-w-36 -translate-y-full rounded-md border border-panel-3 bg-[#1b1b1b] px-3 py-2 text-xs shadow-xl shadow-black/50"
            style={{ left: `${left}%`, transform: `translate(${left > 70 ? "-100%" : left < 30 ? "0%" : "-50%"}, -100%)` }}
          >
            <p className="font-medium text-cream">{shown.date}</p>
            <p className="mt-1 flex justify-between gap-4">
              <span className="text-stone">{label}</span>
              <span className="font-mono text-cream tabular-nums">{shown.text}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-stone">{c.share}</span>
              <span className="font-mono text-cream/80 tabular-nums">{shown.share}</span>
            </p>
          </div>
        )}
      </div>
      {points.length > 0 && (
        <figcaption className="mt-1.5 flex justify-between text-[11px] text-stone">
          <span>{points[0].date}</span>
          {points.length > 2 && <span>{points[Math.floor(points.length / 2)].date}</span>}
          <span>{points[points.length - 1].date}</span>
        </figcaption>
      )}
    </figure>
  );
}
