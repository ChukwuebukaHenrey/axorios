import type { AgPageState, AgReportState } from "ag-studio";
import { describe, expect, it } from "vitest";
import { PAGED_GRID, PAGED_GRID_SPAN, PHONE_PAGER_EXTRA, SHORT_GRID_SPAN } from "./paged-grid-config";
import { defaultReport, upgradeSaved } from "./studio-report";
import { phoneLayout, reflow, type Layout } from "./studio-layout";

const sales = defaultReport.pages.find((p) => p.id === "sales") as AgPageState;

/** No two widgets share a cell, and none runs past the 24 columns. */
function overlaps(layout: Layout) {
  const cells = new Set<string>();
  for (const l of Object.values(layout)) {
    if (l.xTrack + l.xSpan > 24) return true;
    for (let x = l.xTrack; x < l.xTrack + l.xSpan; x++)
      for (let y = l.yTrack; y < l.yTrack + l.ySpan; y++) {
        const key = `${x}:${y}`;
        if (cells.has(key)) return true;
        cells.add(key);
      }
  }
  return false;
}

describe("Analytics phone layout", () => {
  it("puts KPI tiles two to a row and charts full width, in reading order, without overlaps", () => {
    const l = phoneLayout(sales, false);
    expect([l["kpi-sales"].xSpan, l["kpi-orders"].xSpan, l["kpi-aov"].xSpan, l["kpi-net"].xSpan]).toEqual([12, 12, 12, 12]);
    expect(l["kpi-sales"].yTrack).toBe(l["kpi-orders"].yTrack);
    expect(l["kpi-aov"].yTrack).toBeGreaterThan(l["kpi-sales"].yTrack);
    expect(l["sales-time"]).toMatchObject({ xTrack: 0, xSpan: 24 });
    expect(l["sales-month"].yTrack).toBeGreaterThan(l["sales-time"].yTrack);
    expect(overlaps(l)).toBe(false);
  });

  it("stacks every widget in one column on very narrow screens", () => {
    const l = phoneLayout(sales, true);
    expect(Object.values(l).every((w) => w.xSpan === 24 && w.xTrack === 0)).toBe(true);
    expect(overlaps(l)).toBe(false);
  });

  it("lays out every default page without overlaps", () => {
    for (const page of defaultReport.pages) expect(overlaps(phoneLayout(page as AgPageState, false))).toBe(false);
  });

  it("gives the desktop layout back unchanged when the screen widens again", () => {
    const kept = new Map<string, Layout>();
    const onPhone = reflow(defaultReport as AgReportState, true, false, kept);
    expect(onPhone.pages[0].widgetLayout).not.toEqual(defaultReport.pages[0].widgetLayout);
    const back = reflow(onPhone, false, false, kept);
    back.pages.forEach((p, i) => expect(p.widgetLayout).toEqual(defaultReport.pages[i].widgetLayout));
  });

  it("keeps paged tables at their full height on phones, so a page of rows never scrolls inside the card", () => {
    for (const [id, widget, span] of [
      ["reconciliation", "grid", PAGED_GRID_SPAN],
      ["paypal", "grid", PAGED_GRID_SPAN],
      ["channels", "channel-grid", SHORT_GRID_SPAN],
      ["marketing", "funnel", SHORT_GRID_SPAN],
    ] as const) {
      const page = defaultReport.pages.find((p) => p.id === id) as AgPageState;
      expect((page.widgets as Record<string, { type: string }>)[widget].type).toBe(PAGED_GRID);
      expect(phoneLayout(page, false)[widget]).toMatchObject({ xTrack: 0, xSpan: 24, ySpan: span + PHONE_PAGER_EXTRA });
    }
  });

  it("upgrades a report saved before the paged tables, keeping everything else", () => {
    const old = structuredClone(defaultReport) as AgReportState;
    const rec = old.pages.find((p) => p.id === "reconciliation")!;
    (rec.widgets as Record<string, { type: string }>).grid.type = "grid";
    (rec.widgetLayout as Layout).grid.ySpan = 34;
    const up = upgradeSaved(old);
    const after = up.pages.find((p) => p.id === "reconciliation")!;
    expect((after.widgets as Record<string, { type: string }>).grid.type).toBe(PAGED_GRID);
    expect((after.widgetLayout as Layout).grid.ySpan).toBe(PAGED_GRID_SPAN);
    expect(up.pages.find((p) => p.id === "sales")).toEqual(old.pages.find((p) => p.id === "sales"));
  });

  it("moves charts below an upgraded short table down so nothing overlaps", () => {
    const old = structuredClone(defaultReport) as AgReportState;
    const mk = old.pages.find((p) => p.id === "marketing")!;
    (mk.widgets as Record<string, { type: string }>).funnel.type = "grid";
    const l = mk.widgetLayout as Layout;
    l.funnel.ySpan = 14;
    l["by-type"].yTrack = l["by-length"].yTrack = 21;
    const after = upgradeSaved(old).pages.find((p) => p.id === "marketing")!.widgetLayout as Layout;
    expect(after.funnel.ySpan).toBe(SHORT_GRID_SPAN);
    expect(after["by-type"].yTrack).toBe(7 + SHORT_GRID_SPAN);
    expect(after["kpi-reach"].yTrack).toBe(0);
  });
});
