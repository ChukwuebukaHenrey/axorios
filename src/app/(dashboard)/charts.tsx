/**
 * Small server-rendered charts for the numbers pages. Single series only (one hue: lime), thin marks with rounded
 * data ends on the baseline, a native tooltip per mark, recessive axis. Pages show the same numbers in a table.
 */

/** Daily bars, e.g. Money in per day. `format` renders the tooltip value. */
export function DayBars({ data, format, label }: { data: { day: string; value: number }[]; format: (v: number) => string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  const gap = data.length > 60 ? 0.15 : 0.3;
  const first = data[0]?.day;
  const last = data[data.length - 1]?.day;
  const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <figure className="w-full">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={label} className="h-40 w-full overflow-visible">
        <line x1="0" x2="100" y1="40" y2="40" className="stroke-panel-3" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const h = (d.value / max) * 38;
          return (
            <g key={d.day} className="group">
              <rect x={i * w} y="0" width={w} height="40" fill="transparent">
                <title>{`${short(d.day)}: ${format(d.value)}`}</title>
              </rect>
              {h > 0 && (
                <rect
                  x={i * w + gap}
                  y={40 - h}
                  width={Math.max(0.2, w - gap * 2)}
                  height={h}
                  rx={Math.min(0.6, (w - gap * 2) / 2)}
                  className="pointer-events-none fill-lime/80 group-hover:fill-lime"
                />
              )}
            </g>
          );
        })}
      </svg>
      {first && last && (
        <figcaption className="mt-1 flex justify-between text-xs text-stone">
          <span>{short(first)}</span>
          <span>{short(last)}</span>
        </figcaption>
      )}
    </figure>
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
