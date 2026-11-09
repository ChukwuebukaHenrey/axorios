"use client";

// Analytics: one AG Studio instance over the store's own rows. The page owns page tabs, the period toggle, edit mode
// and saving (localStorage, per browser and store); Studio owns the report being looked at.
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AgReportState, AgStudioApi, AgStudioMode } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { Pencil, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudioRows } from "@/modules/analytics/studio-rows";
import { buildStudioData } from "./studio-data";
import { defaultReport, PAGE_TITLES, PERIOD_FIELD } from "./studio-report";
import { axoriStudioTheme } from "./studio-theme";

export type PeriodKey = "7d" | "30d" | "3m" | "6m";
type Ranges = Record<PeriodKey, { from: string; to: string }>;
type Labels = {
  periods: Record<PeriodKey, string>;
  edit: string;
  done: string;
  save: string;
  saved: string;
  reset: string;
  loading: string;
  pages: string;
};

const noSubscription = () => () => {};

/** Puts the period on every page that has a period field, replacing an earlier period filter there. */
function withPeriod(
  state: AgReportState,
  range: { from: string; to: string },
): AgReportState {
  return {
    ...state,
    pages: state.pages.map((p) => {
      const field = PERIOD_FIELD[p.id];
      if (!field) return p;
      const others = (p.filter?.page ?? []).filter((f) => f.field.id !== field);
      return {
        ...p,
        filter: {
          ...p.filter,
          page: [
            ...others,
            {
              field: { id: field },
              model: { operator: "between", value: [range.from, range.to] },
            },
          ],
        },
      };
    }),
  };
}

function readSaved(key: string): AgReportState | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as AgReportState) : null;
  } catch {
    return null;
  }
}

export function AnalyticsStudio(props: {
  rows: StudioRows;
  licenseKey?: string;
  ranges: Ranges;
  storageKey: string;
  labels: Labels;
}) {
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  if (!inBrowser)
    return (
      <div
        className="h-[70vh] animate-pulse rounded-2xl border border-panel-3 bg-panel"
        aria-label={props.labels.loading}
      />
    );
  return <Studio {...props} />;
}

function Studio({
  rows,
  licenseKey,
  ranges,
  storageKey,
  labels,
}: {
  rows: StudioRows;
  licenseKey?: string;
  ranges: Ranges;
  storageKey: string;
  labels: Labels;
}) {
  const apiRef = useRef<AgStudioApi | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("6m");
  const [mode, setMode] = useState<AgStudioMode>("view");
  const [pageId, setPageId] = useState("sales");
  const [note, setNote] = useState("");
  const [initialState] = useState(() => {
    const base = readSaved(storageKey) ?? defaultReport;
    return withPeriod(
      {
        ...base,
        panels: {
          ...base.panels,
          filters: { ...base.panels?.filters, collapsed: true },
        },
      },
      ranges["6m"],
    );
  });
  const data = useMemo(() => buildStudioData(rows), [rows]);

  const update = (next: (s: AgReportState) => AgReportState) => {
    const api = apiRef.current;
    if (api) api.setState(next(api.getState()));
  };
  const choosePeriod = (p: PeriodKey) => {
    setPeriod(p);
    update((s) => withPeriod(s, ranges[p]));
  };
  const choosePage = (id: string) => {
    setPageId(id);
    update((s) => ({ ...s, selectedPageId: id }));
  };
  const save = () => {
    const api = apiRef.current;
    if (!api) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(api.getState()));
      setNote(labels.saved);
    } catch {
      setNote("");
    }
  };
  const reset = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    apiRef.current?.setState(
      withPeriod({ ...defaultReport, selectedPageId: pageId }, ranges[period]),
    );
    apiRef.current?.clearHistory();
    setNote("");
  };

  const pages = initialState.pages.map((p) => ({
    id: p.id,
    title: PAGE_TITLES[p.id] ?? p.id,
  }));
  const periodOn = !!PERIOD_FIELD[pageId];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label={labels.pages}
          className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1"
        >
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choosePage(p.id)}
              aria-current={p.id === pageId ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm whitespace-nowrap ${p.id === pageId ? "bg-lime text-ink" : "text-cream/80 hover:bg-panel-2"}`}
            >
              {p.title}
            </button>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Period"
            className={`flex rounded-full border border-panel-3 p-0.5 ${periodOn ? "" : "opacity-50"}`}
          >
            {(Object.keys(ranges) as PeriodKey[]).map((p) => (
              <button
                key={p}
                type="button"
                data-period={p}
                disabled={!periodOn}
                aria-pressed={p === period}
                onClick={() => choosePeriod(p)}
                className={`rounded-full px-2.5 py-1 text-xs ${p === period ? "bg-panel-3 text-cream" : "text-stone hover:text-cream"}`}
              >
                {labels.periods[p]}
              </button>
            ))}
          </div>
          {mode === "edit" ? (
            <>
              <Button size="sm" onClick={save}>
                <Save className="size-4" aria-hidden="true" /> {labels.save}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMode("view")}
              >
                <X className="size-4" aria-hidden="true" /> {labels.done}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setMode("edit")}>
              <Pencil className="size-4" aria-hidden="true" /> {labels.edit}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            title={labels.reset}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span className="sr-only">{labels.reset}</span>
          </Button>
          {note && (
            <span className="text-xs text-stone" role="status">
              {note}
            </span>
          )}
        </div>
      </div>
      <div className="h-[78vh] min-h-[560px] overflow-hidden rounded-2xl border border-panel-3">
        <AgStudioProvider licenseKey={licenseKey}>
          <AgStudio
            style={{ height: "100%", width: "100%" }}
            theme={axoriStudioTheme}
            layout={{ widgetBorderEnabled: true }}
            data={data}
            initialState={initialState}
            mode={mode}
            onApiReady={(e) => {
              apiRef.current = e.api;
              (
                window as unknown as { __axoriStudio?: AgStudioApi }
              ).__axoriStudio = e.api;
            }}
            onStateUpdated={(e) => {
              if (e.state.selectedPageId !== pageId)
                setPageId(e.state.selectedPageId);
            }}
          />
        </AgStudioProvider>
      </div>
    </div>
  );
}
