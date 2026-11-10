"use client";

// Analytics: one AG Studio instance over the store's own rows. The page owns page tabs, the period toggle, edit mode
// and saving (localStorage, per browser and store); Studio owns the report being looked at.
//
// Layout: the report grows to its own height, so the page is the only thing that scrolls (Studio's own scroller is
// sized to fit and never kicks in). On phones the widgets reflow (KPIs two to a row, charts full width) and the filter
// panel opens as a bottom sheet instead of a strip beside the charts. Editing the layout is a desktop job.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AgReportState, AgStudioApi, AgStudioMode } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { Eraser, ListFilter, MoreHorizontal, Pencil, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/smoothui/popover";
import { Segmented } from "@/components/ui/segmented";
import type { StudioRows } from "@/modules/analytics/studio-rows";
import { buildStudioData } from "./studio-data";
import { reflow, type Layout } from "./studio-layout";
import { defaultReport, PAGE_TITLES, PERIOD_FIELD } from "./studio-report";
import { axoriStudioTheme } from "./studio-theme";

export type PeriodKey = "7d" | "30d" | "3m" | "6m";
type Ranges = Record<PeriodKey, { from: string; to: string }>;
type Labels = {
  periods: Record<PeriodKey, string>;
  period: string;
  edit: string;
  done: string;
  save: string;
  saved: string;
  reset: string;
  loading: string;
  pages: string;
  filters: string;
  hideFilters: string;
  moreActions: string;
  clearFilters: string;
};

const noSubscription = () => () => {};
const menuItem =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-cream transition-colors hover:bg-panel-2 focus-visible:bg-panel-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

/** Viewport breakpoints as live values (md = 768 px, matching the workspace's Tailwind breakpoints). */
function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Puts the period on every page that has a period field, replacing an earlier period filter there. */
function withPeriod(state: AgReportState, range: { from: string; to: string }): AgReportState {
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
          page: [...others, { field: { id: field }, model: { operator: "between", value: [range.from, range.to] } }],
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

/**
 * The height Studio needs to show the open page without its own scrollbar: the canvas's content height (Studio
 * sets it as min-height from the widget grid) plus the scroller's padding and any chrome around it.
 */
function useFitHeight(root: React.RefObject<HTMLDivElement | null>, floor: number) {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scroller = [...el.querySelectorAll<HTMLElement>(".ag-studio-layout")].find((n) => n.offsetParent !== null);
        const canvas = scroller?.querySelector<HTMLElement>(".ag-studio-layout-canvas");
        const content = canvas ? parseFloat(canvas.style.minHeight || canvas.style.height) : NaN;
        if (!scroller || !Number.isFinite(content)) return;
        const pad = parseFloat(getComputedStyle(scroller).paddingTop) + parseFloat(getComputedStyle(scroller).paddingBottom);
        const chrome = el.getBoundingClientRect().height - scroller.getBoundingClientRect().height;
        // Studio itself adds 2 px to the canvas; a little slack keeps its scrollbar from ever appearing.
        const next = Math.max(Math.ceil(content + pad + Math.max(chrome, 0)) + 4, floor);
        setHeight((prev) => (prev === next ? prev : next));
      });
    };
    const watch = new MutationObserver(measure);
    watch.observe(el, { subtree: true, attributes: true, attributeFilter: ["style", "class"], childList: true });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
      resize.disconnect();
    };
  }, [root, floor]);
  return height;
}

export function AnalyticsStudio(props: { rows: StudioRows; licenseKey?: string; ranges: Ranges; storageKey: string; labels: Labels }) {
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  if (!inBrowser) return <div className="h-[640px] animate-pulse rounded-xl border border-panel-3 bg-panel" aria-label={props.labels.loading} />;
  return <Studio {...props} />;
}

function Studio({ rows, licenseKey, ranges, storageKey, labels }: { rows: StudioRows; licenseKey?: string; ranges: Ranges; storageKey: string; labels: Labels }) {
  const apiRef = useRef<AgStudioApi | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Desktop layouts set aside while the phone layout is showing (one Map for the life of the page).
  const [kept] = useState(() => new Map<string, Layout>());
  const phone = useMedia("(max-width: 767px)");
  const single = useMedia("(max-width: 379px)");
  const [period, setPeriod] = useState<PeriodKey>("6m");
  const [editing, setEditing] = useState(false);
  const mode: AgStudioMode = editing && !phone ? "edit" : "view";
  const [pageId, setPageId] = useState("sales");
  const [note, setNote] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterCount, setFilterCount] = useState(0);
  const [initialState] = useState(() => {
    const base = readSaved(storageKey) ?? defaultReport;
    const state = withPeriod({ ...base, panels: { ...base.panels, filters: { ...base.panels?.filters, collapsed: false } } }, ranges["6m"]);
    return phone ? reflow(state, true, single, kept) : state;
  });
  const data = useMemo(() => buildStudioData(rows), [rows]);
  const fit = useFitHeight(rootRef, mode === "edit" ? 640 : 320);

  const update = useCallback((next: (s: AgReportState) => AgReportState) => {
    const api = apiRef.current;
    if (api) api.setState(next(api.getState()));
  }, []);

  // Rotate a tablet or resize the window: swap layouts in place, keeping filters, period and the open page.
  const shape = `${phone}:${single}`;
  const laidOut = useRef(shape);
  useEffect(() => {
    if (laidOut.current === shape) return;
    laidOut.current = shape;
    update((s) => reflow(s, phone, single, kept));
  }, [shape, phone, single, update, kept]);

  // The filter panel is shown only while it's wanted: no collapsed strip eating chart width.
  // Declaring `view` means `edit` must be declared too; this is Studio's own default for edit mode.
  const panels = useMemo(
    () => ({
      view: { right: filtersOpen ? ["filters" as const] : [] },
      edit: { left: ["ai" as const], right: ["filters" as const, "edit" as const, "data" as const] },
    }),
    [filtersOpen],
  );
  const layout = useMemo(() => ({ widgetBorderEnabled: true, minWidth: 0 }), []);

  /** Page filters on the open page, not counting the period (it has its own strip). */
  const countFilters = useCallback((st: AgReportState) => {
    const page = st.pages.find((p) => p.id === st.selectedPageId);
    return (page?.filter?.page ?? []).filter((f) => f.field.id !== PERIOD_FIELD[st.selectedPageId]).length;
  }, []);

  const choosePeriod = (p: PeriodKey) => {
    setPeriod(p);
    update((s) => withPeriod(s, ranges[p]));
  };
  const choosePage = (id: string) => {
    setPageId(id);
    update((s) => ({ ...s, selectedPageId: id }));
  };
  const toggleFilters = () => {
    const next = !filtersOpen;
    setFiltersOpen(next);
    if (next) update((st) => ({ ...st, panels: { ...st.panels, filters: { ...st.panels?.filters, collapsed: false } } }));
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
    kept.clear();
    const fresh = withPeriod({ ...defaultReport, selectedPageId: pageId }, ranges[period]);
    apiRef.current?.setState(phone ? reflow(fresh, true, single, kept) : fresh);
    apiRef.current?.clearHistory();
    setNote("");
  };

  // Close the sheet with Esc on phones.
  useEffect(() => {
    if (!filtersOpen || !phone) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFiltersOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen, phone]);

  const pages = initialState.pages.map((p) => ({ id: p.id, title: PAGE_TITLES[p.id] ?? p.id }));
  const periodOn = !!PERIOD_FIELD[pageId];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3">
        <Segmented
          label={labels.pages}
          value={pageId}
          onChange={choosePage}
          items={pages.map((p) => ({ value: p.id, label: p.title }))}
          className="w-full md:w-auto [mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)] md:[mask-image:none]"
        />
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label={labels.period}
            className={`flex min-w-0 flex-1 rounded-lg border border-panel-3 bg-panel p-0.5 md:flex-none ${periodOn ? "" : "opacity-50"}`}
          >
            {(Object.keys(ranges) as PeriodKey[]).map((p) => (
              <button
                key={p}
                type="button"
                data-period={p}
                disabled={!periodOn}
                aria-pressed={p === period}
                onClick={() => choosePeriod(p)}
                className={`h-8 min-w-0 flex-1 rounded-md px-2 text-xs font-medium whitespace-nowrap transition-colors md:h-7 md:flex-none md:px-2.5 ${p === period ? "bg-panel-3 text-cream shadow-[0_1px_2px_rgb(0_0_0/0.4)]" : "text-stone hover:bg-white/[0.03] hover:text-cream"}`}
              >
                {labels.periods[p]}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleFilters}
            aria-pressed={filtersOpen}
            aria-label={filtersOpen ? labels.hideFilters : labels.filters}
            data-filters={filterCount}
            className={`h-9 shrink-0 md:h-8 ${filtersOpen ? "border-lime/40 bg-[#1c2112] text-cream" : ""}`}
          >
            <ListFilter className="size-4" aria-hidden="true" />
            <span className="max-sm:sr-only">{labels.filters}</span>
            {filterCount > 0 && <span className="rounded-full bg-lime px-1.5 text-[11px] leading-4 font-semibold text-ink tabular-nums">{filterCount}</span>}
          </Button>
          <PopoverRoot>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" aria-label={labels.moreActions} className="h-9 w-9 shrink-0 px-0 md:h-8 md:w-8">
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 border-panel-3 bg-panel p-1.5 text-cream">
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
            </PopoverContent>
          </PopoverRoot>
          <div className="hidden items-center gap-2 md:flex">
            {mode === "edit" ? (
              <>
                <Button size="sm" onClick={save}>
                  <Save className="size-4" aria-hidden="true" /> {labels.save}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  <X className="size-4" aria-hidden="true" /> {labels.done}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
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
      </div>

      {phone && filtersOpen && (
        <button type="button" aria-label={labels.hideFilters} onClick={() => setFiltersOpen(false)} className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-[1px]" />
      )}
      <div
        ref={rootRef}
        data-studio-sheet={phone && filtersOpen ? "open" : undefined}
        className="axori-studio overflow-hidden rounded-xl border border-panel-3"
        style={{ height: fit ?? 640 }}
      >
        <AgStudioProvider licenseKey={licenseKey}>
          <AgStudio
            style={{ height: "100%", width: "100%" }}
            theme={axoriStudioTheme}
            layout={layout}
            panels={panels}
            data={data}
            initialState={initialState}
            mode={mode}
            onApiReady={(e) => {
              apiRef.current = e.api;
              (window as unknown as { __axoriStudio?: AgStudioApi }).__axoriStudio = e.api;
            }}
            onStateUpdated={(e) => {
              if (e.state.selectedPageId !== pageId) setPageId(e.state.selectedPageId);
              setFilterCount(countFilters(e.state));
              // Studio's own chevron folds the panel: treat that as closing it.
              if (filtersOpen && e.state.panels?.filters?.collapsed) setFiltersOpen(false);
            }}
          />
        </AgStudioProvider>
      </div>
    </div>
  );
}
