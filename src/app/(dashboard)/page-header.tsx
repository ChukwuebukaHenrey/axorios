import type { CSSProperties, ReactNode } from "react";
import ScrollArea from "@/components/smoothui/scroll-area";
import Separator from "@/components/smoothui/separator";
import Skeleton from "@/components/smoothui/skeleton";
import { t } from "@/lib/messages";
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

/* ---------- Loading skeletons: the same shapes as the pieces above, shown by each route's loading.tsx ---------- */

/** One placeholder bar (SmoothUI Skeleton, shimmer off under reduced motion). */
export function Bone({ className, style }: { className?: string; style?: CSSProperties }) {
  return <Skeleton className={cn("bg-panel-3", className)} style={style} />;
}

/** Wraps a whole loading page. Same padding as every workspace page. */
export function PageSkeleton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main aria-busy="true" aria-label={t.app.loadingPage} className={cn("flex-1 overflow-y-auto px-4 pt-6 pb-10 sm:px-6 lg:px-8", className)}>
      {children}
    </main>
  );
}

/** Title and subtitle lines at the heights of `PageHeader`; `actions` adds button shapes on the right. */
export function PageHeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="w-full max-w-2xl">
        <div className="flex h-[1.25em] items-center text-[clamp(1.6rem,2.6vw,2.25rem)] leading-tight">
          <Bone className="h-[0.8em] w-56 max-w-full" />
        </div>
        <div className="mt-1 flex h-6 items-center">
          <Bone className="h-4 w-full max-w-md" />
        </div>
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Bone key={i} className="h-9 w-28" />
          ))}
        </div>
      )}
    </div>
  );
}

/** The `Segmented` strip: `tabs` items, `md` or `sm` height. */
export function SegmentedSkeleton({ tabs, size = "md" }: { tabs: number; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex max-w-full items-center gap-0.5 overflow-hidden rounded-lg border border-panel-3 bg-panel p-0.5">
      {Array.from({ length: tabs }, (_, i) => (
        <span key={i} className={cn("flex shrink-0 items-center px-2.5", size === "sm" ? "h-7" : "h-8")}>
          <Bone className={cn(size === "sm" ? "h-3 w-7" : "h-3.5", size === "md" && (i === 0 ? "w-12" : "w-16"))} />
        </span>
      ))}
    </div>
  );
}

/** The tab row under a page header: tab strip on the left, optional period strip or search box on the right. */
export function TabRowSkeleton({ tabs, right }: { tabs: number; right?: "period" | "search" }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-panel-3 pb-4">
      <SegmentedSkeleton tabs={tabs} />
      {right === "period" && <SegmentedSkeleton tabs={4} size="sm" />}
      {right === "search" && <div className="h-8 w-full animate-pulse rounded-md border border-panel-3 bg-panel sm:w-72" />}
    </div>
  );
}

/** `StatTile` at its real size. */
export function StatTileSkeleton({ detail = true }: { detail?: boolean }) {
  return (
    <div className="animate-pulse rounded-xl border border-panel-3 bg-panel px-5 py-4">
      <div className="flex h-5 items-center">
        <Bone className="h-3.5 w-24" />
      </div>
      <div className="mt-1.5 flex h-8 items-center">
        <Bone className="h-6 w-28" />
      </div>
      {detail && (
        <div className="mt-1 flex h-5 items-center">
          <Bone className="h-3 w-36" />
        </div>
      )}
    </div>
  );
}

/** A row of stat tiles in the grid the pages use. */
export function StatRowSkeleton({ count = 4, detail = true, className }: { count?: number; detail?: boolean; className?: string }) {
  return (
    <section className={cn("grid gap-3 sm:grid-cols-2", count === 3 || count === 6 ? "xl:grid-cols-3" : "xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <StatTileSkeleton key={i} detail={detail} />
      ))}
    </section>
  );
}

/** `Panel` shell: header with a title bar (and an optional action shape), divider, then the body. */
export function PanelSkeleton({
  children,
  note,
  action,
  flush,
  className,
}: {
  children?: ReactNode;
  note?: boolean;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("flex animate-pulse flex-col rounded-xl border border-panel-3 bg-panel", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
        <div>
          <div className="flex h-5 items-center">
            <Bone className="h-3.5 w-32" />
          </div>
          {note && (
            <div className="mt-0.5 flex h-4 items-center">
              <Bone className="h-2.5 w-48" />
            </div>
          )}
        </div>
        {action}
      </div>
      <Separator decorative className="bg-panel-3" />
      <div className={cn("flex min-h-0 flex-1 flex-col", !flush && "p-5")}>{children ?? <LinesSkeleton />}</div>
    </section>
  );
}

/** A few text lines of falling width, for panel bodies. */
export function LinesSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ["w-full", "w-5/6", "w-2/3", "w-3/4", "w-1/2"];
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className={cn("h-3.5", widths[i % widths.length])} />
      ))}
    </div>
  );
}

/** List rows for flush panels and tables: two stacked lines on the left, a short value on the right. */
export function RowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <ul className={cn("divide-y divide-panel-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-3.5 w-40 max-w-full" />
            <Bone className="h-3 w-24" />
          </div>
          <Bone className="h-4 w-16 shrink-0" />
        </li>
      ))}
    </ul>
  );
}

/** The `DayBars` block: summary line over a 176px bar area. */
export function ChartSkeleton({ height = 176 }: { height?: number }) {
  const bars = [38, 52, 30, 64, 46, 72, 40, 58, 34, 80, 50, 62, 44, 70];
  return (
    <div>
      <div className="flex gap-6">
        <Bone className="h-3.5 w-24" />
        <Bone className="h-3.5 w-24" />
        <Bone className="h-3.5 w-24" />
      </div>
      <div className="mt-4 flex items-end gap-1.5" style={{ height }}>
        {bars.map((h, i) => (
          <Bone key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/** A scrolling list column (SmoothUI ScrollArea), for the Inbox chat list. */
export function ScrollListSkeleton({ rows = 8, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <ScrollArea className="min-h-0 flex-1" horizontal={false}>
      <ul>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-3 border-b border-panel-3 px-4 py-3">
            {avatar && <Bone className="size-9 shrink-0 rounded-full" />}
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-3.5 w-32" />
              <Bone className="h-3 w-full max-w-48" />
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
