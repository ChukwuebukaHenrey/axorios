"use client";

// Analytics: one AG Studio instance over the store's own rows. The page owns page tabs, the period toggle, edit mode
// and saving (localStorage, per browser and store); Studio owns the report being looked at.
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AgReportState, AgStudioApi, AgStudioMode } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { Eraser, ListFilter, PanelRight, Pencil, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/smoothui/popover";
import { Segmented } from "@/components/ui/segmented";
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
  filters: string;
  filtersNote: string;
  filterPanel: string;
  clearFilters: string;
  noFilters: string;
  activeFilters: string;
};

const noSubscription = () => () => {};
const menuItem =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-cream transition-colors hover:bg-panel-2 focus-visible:bg-panel-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

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
        className="h-[70vh] animate-pulse rounded-xl border border-panel-3 bg-panel"
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [filterCount, setFilterCount] = useState(0);

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
  /** Page filters on the open page, not counting the period (it has its own strip). */
  const ownFilters = (st: AgReportState) => {
    const page = st.pages.find((p) => p.id === st.selectedPageId);
    return (page?.filter?.page ?? []).filter((f) => f.field.id !== PERIOD_FIELD[st.selectedPageId]);
  };
  const toggleFilterPanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    update((st) => ({ ...st, panels: { ...st.panels, filters: { ...st.panels?.filters, collapsed: !next } } }));
  };
  const clearFilters = () =>
    update((st) => ({
      ...st,
      pages: st.pages.map((p) =>
        p.id !== st.selectedPageId ? p : { ...p, filter: { ...p.filter, page: (p.filter?.page ?? []).filter((f) => f.field.id === PERIOD_FIELD[p.id]) } },
      ),
    }));
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
        <Segmented label={labels.pages} value={pageId} onChange={choosePage} items={pages.map((p) => ({ value: p.id, label: p.title }))} />
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Period"
            className={`flex rounded-lg border border-panel-3 bg-panel p-0.5 ${periodOn ? "" : "opacity-50"}`}
          >
            {(Object.keys(ranges) as PeriodKey[]).map((p) => (
              <button
                key={p}
                type="button"
                data-period={p}
                disabled={!periodOn}
                aria-pressed={p === period}
                onClick={() => choosePeriod(p)}
                className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${p === period ? "bg-panel-3 text-cream shadow-[0_1px_2px_rgb(0_0_0/0.4)]" : "text-stone hover:bg-white/[0.03] hover:text-cream"}`}
              >
                {labels.periods[p]}
              </button>
            ))}
          </div>
          <PopoverRoot onOpenChange={(open) => open && apiRef.current && setFilterCount(ownFilters(apiRef.current.getState()).length)}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" data-filters={filterCount}>
                <ListFilter className="size-4" aria-hidden="true" /> {labels.filters}
                {filterCount > 0 && <span className="rounded-full bg-lime px-1.5 text-[11px] leading-4 font-semibold text-ink tabular-nums">{filterCount}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 border-panel-3 bg-panel p-0 text-cream">
              <div className="border-b border-panel-3 px-4 py-3">
                <p className="text-sm font-semibold">{labels.filters}</p>
                <p className="mt-0.5 text-xs text-stone">{labels.filtersNote}</p>
              </div>
              <p className="px-4 pt-3 text-xs text-stone" role="status">
                {filterCount === 0 ? labels.noFilters : labels.activeFilters.replace("{count}", String(filterCount))}
              </p>
              <div className="flex flex-col gap-0.5 p-2">
                <button type="button" onClick={toggleFilterPanel} aria-pressed={panelOpen} className={menuItem}>
                  <PanelRight className="size-4 text-stone" aria-hidden="true" />
                  <span className="flex-1">{labels.filterPanel}</span>
                  <span className={`h-4 w-7 rounded-full p-0.5 transition-colors ${panelOpen ? "bg-lime" : "bg-panel-3"}`} aria-hidden="true">
                    <span className={`block size-3 rounded-full bg-ink transition-transform ${panelOpen ? "translate-x-3" : ""}`} />
                  </span>
                </button>
                <button
                  type="button"
                  disabled={filterCount === 0}
                  onClick={() => {
                    clearFilters();
                    setFilterCount(0);
                  }}
                  className={menuItem}
                >
                  <Eraser className="size-4 text-stone" aria-hidden="true" /> {labels.clearFilters}
                </button>
                <button type="button" onClick={reset} className={menuItem}>
                  <RotateCcw className="size-4 text-stone" aria-hidden="true" /> {labels.reset}
                </button>
              </div>
            </PopoverContent>
          </PopoverRoot>
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
          {note && (
            <span className="text-xs text-stone" role="status">
              {note}
            </span>
          )}
        </div>
      </div>
      <div className="h-[78vh] min-h-[560px] overflow-hidden rounded-xl border border-panel-3">
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
