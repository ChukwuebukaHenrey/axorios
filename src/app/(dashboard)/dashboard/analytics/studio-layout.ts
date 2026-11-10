// Phone layouts for the Analytics report. Pure, so the reflow is tested without AG Studio.
import type { AgPageState, AgReportState, AgWidgetLayoutState } from "ag-studio";

const COLUMNS = 24;
export type Layout = Record<string, AgWidgetLayoutState>;

/**
 * A phone layout for one page, in the desktop reading order: KPI tiles two to a row (one when `single`),
 * everything else full width at a height that keeps axis labels readable.
 */
export function phoneLayout(page: AgPageState, single: boolean): Layout {
  const entries = Object.entries((page.widgetLayout ?? {}) as Layout).sort(([, a], [, b]) => a.yTrack - b.yTrack || a.xTrack - b.xTrack);
  const out: Layout = {};
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const [id, l] of entries) {
    const tile = (page.widgets as Record<string, { type?: string }> | undefined)?.[id]?.type === "value";
    const span = tile && !single ? COLUMNS / 2 : COLUMNS;
    if (x + span > COLUMNS) {
      y += rowHeight;
      x = 0;
      rowHeight = 0;
    }
    const height = tile ? Math.max(l.ySpan, 6) : Math.min(Math.max(l.ySpan, 15), 22);
    out[id] = { xTrack: x, yTrack: y, xSpan: span, ySpan: height };
    x += span;
    rowHeight = Math.max(rowHeight, height);
  }
  return out;
}

/** Swaps every page's layout between desktop and phone. Desktop layouts are kept aside in `kept` to come back to. */
export function reflow(state: AgReportState, phone: boolean, single: boolean, kept: Map<string, Layout>): AgReportState {
  return {
    ...state,
    pages: state.pages.map((p) => {
      if (phone) {
        if (!kept.has(p.id)) kept.set(p.id, (p.widgetLayout ?? {}) as Layout);
        return { ...p, widgetLayout: phoneLayout({ ...p, widgetLayout: kept.get(p.id) }, single) };
      }
      const desktop = kept.get(p.id);
      return desktop ? { ...p, widgetLayout: desktop } : p;
    }),
  };
}
