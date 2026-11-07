import type { ReactNode } from "react";

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

export function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-panel-3 bg-panel p-5">
      <p className="text-sm text-stone">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-cream">{value}</p>
      <p className="mt-1 text-sm text-stone" suppressHydrationWarning>
        {detail}
      </p>
    </div>
  );
}
