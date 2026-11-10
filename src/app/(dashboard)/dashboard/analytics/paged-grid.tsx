"use client";

// A paged table widget for AG Studio. Studio's own grid scrolls inside a fixed-height card, which on long lists
// (every order, every PayPal transaction) leaves a small window with a nested scrollbar. This widget shows one page
// of rows at a time at full card height, with the SmoothUI pager underneath once there is more than one page.
// Rows come from Studio's own engine (widgetApi.getData), so the period, page filters and cross filters all apply,
// and the Total row covers every filtered row, not just the page.
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import type { AgWidgetData, AgWidgetDataFormat, AgWidgetField, AgWidgetParams } from "ag-studio";
import type { AgWidgetDefinition } from "ag-studio-react";
import Pagination from "@/components/smoothui/pagination";
import { t } from "@/lib/messages";
import { PAGE_SIZE, PAGED_GRID, PAGED_GRID_SPAN } from "./paged-grid-config";

const p = t.app.analytics.pager;


type Widget = AgWidgetData<{ cols: unknown[] }, AgWidgetDataFormat<unknown>>;
type Params = AgWidgetParams<Widget>;
type Row = Record<string, unknown>;

const isNumeric = (f: AgWidgetField) => f.aggregation != null || (f as { dataType?: string }).dataType === "number";

function PagedGrid(params: Params) {
  const { widgetApi, dataMapping, sort } = params;
  const cols = (dataMapping.cols ?? []) as AgWidgetField[];
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<Row | null>(null);
  // Studio can reuse this component for another page's table (both are widget "grid"): a different column set is a
  // different table, so it starts on page 1 (adjusting state from props, without an effect).
  const shape = cols.map((f) => f.key).join("|");
  const [seen, setSeen] = useState(shape);
  if (seen !== shape) {
    setSeen(shape);
    setPage(1);
  }

  // Studio hands the widget a new params object whenever its data could have changed (filters, period, sort,
  // columns), so that object is the refetch key.
  useEffect(() => {
    let live = true;
    const fields = cols;
    if (fields.length === 0) return;
    const order = (sort ?? []).map((s) => ({ field: s.field, direction: s.direction }));
    widgetApi.setDisplayState("loading", { prominent: false });
    Promise.all([
      widgetApi.getData({ fields, sort: order, limit: { count: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } }, { queryId: "rows" }),
      widgetApi.getData({ fields }, { queryId: "grandTotal", grandTotal: true }),
    ])
      .then(([data, grand]) => {
        if (!live) return;
        const count = data.results.metadata?.totalRowCount ?? data.results.rows.length;
        const last = Math.max(1, Math.ceil(count / PAGE_SIZE));
        // Filters can shrink the list under the page being shown: go to its last page instead of an empty one.
        if (page > last) {
          setPage(last);
          return;
        }
        setRows(data.results.rows);
        setTotal(count);
        setTotals(grand.results.rows[0] ?? null);
        widgetApi.setDisplayState("displayed");
      })
      .catch(() => live && widgetApi.setDisplayState("displayed"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `params` identity is the refresh signal (see above).
  }, [params, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sorted = sort?.[0];
  const toggleSort = (f: AgWidgetField) => {
    const desc = sorted?.field.key === f.key && sorted.direction === "asc";
    widgetApi.setSort([{ field: f, direction: desc ? "desc" : "asc" }]);
    setPage(1);
  };
  const cell = (f: AgWidgetField, v: unknown) => widgetApi.formatFieldValue(f, v);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex h-full min-h-0 flex-col px-2 text-[13px] text-cream">
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-max border-collapse tabular-nums">
          <thead>
            <tr className="border-b border-panel-3 text-xs font-semibold text-stone">
              {cols.map((f) => {
                const on = sorted?.field.key === f.key;
                const Arrow = sorted?.direction === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th key={f.key} scope="col" aria-sort={on ? (sorted.direction === "asc" ? "ascending" : "descending") : undefined} className={`h-9 px-2 font-semibold whitespace-nowrap first:pl-0 last:pr-0 ${isNumeric(f) ? "text-right" : "text-left"}`}>
                    <button type="button" onClick={() => toggleSort(f)} className={`inline-flex items-center gap-1 hover:text-cream ${isNumeric(f) ? "flex-row-reverse" : ""}`}>
                      {widgetApi.getFieldName(f)}
                      {on && <Arrow className="size-3.5" aria-hidden="true" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="h-24 text-center text-stone">
                  {p.empty}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="h-9 border-b border-panel-3 hover:bg-panel-2">
                {cols.map((f) => (
                  <td key={f.key} className={`px-2 whitespace-nowrap first:pl-0 last:pr-0 ${isNumeric(f) ? "text-right" : "text-left"}`}>
                    {cell(f, r[f.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && rows.length > 0 && (
            <tfoot>
              <tr className="h-9 font-semibold">
                {cols.map((f, i) => (
                  <td key={f.key} className={`px-2 whitespace-nowrap first:pl-0 last:pr-0 ${isNumeric(f) ? "text-right" : "text-left"}`}>
                    {i === 0 ? p.total : f.aggregation ? cell(f, totals[f.key]) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {total > PAGE_SIZE && (
        <div className="flex shrink-0 flex-col items-center gap-1 border-t border-panel-3 pt-2 sm:flex-row sm:justify-between">
          <span className="text-xs text-stone" role="status">
            {p.range.replace("{from}", String(from)).replace("{to}", String(to)).replace("{total}", String(total))}
          </span>
          <Pagination page={page} totalPages={pages} onPageChange={setPage} labels={p} className="mx-0 w-auto sm:justify-end" />
        </div>
      )}
    </div>
  );
}

/** Registered with Studio through `createWidgets({ additionalTypes: [pagedGridDefinition] })`. */
export const pagedGridDefinition: AgWidgetDefinition<typeof PAGED_GRID, Widget> = {
  id: PAGED_GRID,
  label: p.widget,
  dataMapping: { cols: { type: "fieldset", supportedRoles: ["category", "temporal", "numeric"], sort: true } },
  form: (f) => f.createDefaults({ dataMappingItems: [{ key: "cols", label: p.columns }] }),
  comp: PagedGrid,
  defaultSize: { width: 24, height: PAGED_GRID_SPAN },
  minSize: { width: 8, height: 16 },
};
