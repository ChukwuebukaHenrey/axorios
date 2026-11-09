import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[clamp(1.6rem,2.6vw,2.25rem)] leading-tight font-semibold tracking-[-0.02em] text-cream">{title}</h1>
        <p className="mt-1 max-w-2xl text-base text-cream/75">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

/** One number with its label. Same card on every workspace page. */
export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-panel-3 bg-panel px-5 py-4">
      <p className="text-sm text-stone">{label}</p>
      <p data-stat={label} className="mt-1.5 text-2xl font-semibold tracking-tight text-cream tabular-nums">
        {value}
      </p>
      {detail && (
        <p className="mt-1 text-sm text-stone" suppressHydrationWarning>
          {detail}
        </p>
      )}
    </div>
  );
}

/** A titled card: header row with an optional note and action, divider, then the body. */
export function Panel({
  title,
  note,
  action,
  children,
  flush,
  className,
}: {
  title: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Body without padding, for tables and lists that run edge to edge. */
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border border-panel-3 bg-panel", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-panel-3 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-cream">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-stone">{note}</p>}
        </div>
        {action}
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col", !flush && "p-5")}>{children}</div>
    </section>
  );
}

/** Empty state: icon tile, title, one line of help. */
export function EmptyState({ icon, title, body, children }: { icon: ReactNode; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-panel-3 px-6 py-14 text-center">
      <span className="grid size-10 place-items-center rounded-lg border border-panel-3 bg-panel text-stone [&_svg]:size-4">{icon}</span>
      <h2 className="mt-4 text-sm font-semibold text-cream">{title}</h2>
      {body && <p className="mt-1 max-w-sm text-sm text-stone">{body}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
