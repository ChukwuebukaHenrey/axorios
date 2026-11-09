import { DayBarsChart, type DayPoint } from "./day-bars-chart";

/**
 * Small server-rendered charts for the numbers pages. Single series only (one hue: lime), thin marks with rounded
 * data ends on the baseline, a native tooltip per mark, recessive axis. Pages show the same numbers in a table.
 */

/** Daily bars, e.g. Money in per day. `format` renders the values; the chart itself is interactive (client). */
export function DayBars({ data, format, label }: { data: { day: string; value: number }[]; format: (v: number) => string; label: string }) {
  const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const total = data.reduce((s, d) => s + d.value, 0);
  const top = data.reduce<{ day: string; value: number } | null>((best, d) => (d.value > (best?.value ?? 0) ? d : best), null);
  const points: DayPoint[] = data.map((d) => ({
    day: d.day,
    value: d.value,
    date: short(d.day),
    text: format(d.value),
    share: total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "—",
  }));
  return (
    <DayBarsChart
      points={points}
      label={label}
      total={format(total)}
      average={format(data.length ? Math.round(total / data.length) : 0)}
      peak={top ? `${short(top.day)} · ${format(top.value)}` : null}
    />
  );
}

/** Ranked horizontal bars with the value written at the end, e.g. expenses by category. */
export function RankBars({ rows, format }: { rows: { label: string; value: number; note?: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-cream">{r.label}</span>
            <span className="font-mono text-cream/90 tabular-nums">
              {format(r.value)}
              {r.note && <span className="ml-2 text-xs text-stone">{r.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-panel-3" aria-hidden="true">
            <div className="h-1.5 rounded-full bg-lime/80" style={{ width: `${Math.max(1, (Math.abs(r.value) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tiny line for stat tiles. Decorative: the tile states the number. */
export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" className={`h-8 w-full ${className}`}>
      <polyline points={pts} fill="none" className="stroke-lime" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
