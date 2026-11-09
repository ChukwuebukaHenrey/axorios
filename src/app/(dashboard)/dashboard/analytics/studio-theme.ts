// AG Studio theme from AxoriOS tokens (globals.css), so Studio reads as part of the dark workspace.
import { studioTheme } from "ag-studio";

// globals.css uses `@theme inline`, so its tokens aren't emitted as CSS variables; these mirror them.
const TOKENS: Record<string, string> = {
  cream: "#f5f1e8",
  lime: "#e3ff48",
  panel: "#161616",
  "panel-2": "#1f1f1f",
  "panel-3": "#2a2a2a",
  stone: "#a3a29c",
  background: "#0d0d0d",
};
const v = (name: string) => TOKENS[name];
const line = (name: string) => ({ width: 1, color: v(name) });

// Lime first (single-series charts stay on brand), then distinct hues that hold up on #161616.
const PALETTE = [
  "#e3ff48",
  "#85d6a6",
  "#f97316",
  "#60a5fa",
  "#fbbf24",
  "#c084fc",
  "#f472b6",
  "#2dd4bf",
  "#a3a29c",
  "#ef4444",
];
const palette = Object.fromEntries(
  PALETTE.flatMap((c, i) => [
    [`chartPaletteFills${i + 1}Color`, c],
    [`chartPaletteStrokes${i + 1}Color`, c],
  ]),
);

export const axoriStudioTheme = studioTheme.withParams({
  fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif",
  fontSize: 14,
  textColor: v("cream"),
  foregroundColor: v("cream"),
  subtleTextColor: v("stone"),
  backgroundColor: v("panel"),
  borderColor: v("panel-3"),
  accentColor: v("lime"),
  iconColor: v("cream"),
  rowHoverColor: v("panel-2"),

  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioWrapperBackgroundColor: v("background"),
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: v("background"),
  studioCanvasPadding: 12,
  studioCanvasRowHeight: 18,

  studioWidgetBackgroundColor: v("panel"),
  studioWidgetBorder: line("panel-3"),
  studioWidgetBorderRadius: 16,
  studioWidgetPadding: 12,
  studioWidgetTitleFontSize: 15,
  studioWidgetTitleFontWeight: 600,
  studioWidgetTitleTextColor: v("cream"),
  studioWidgetSubtitleTextColor: v("stone"),
  studioWidgetCaptionTextColor: v("stone"),
  studioWidgetResizeBorderColor: v("lime"),

  studioPanelContainerBackgroundColor: v("panel"),
  studioPanelContainerBorder: line("panel-3"),
  studioPanelContainerBorderRadius: 0,
  studioPanelDividerColor: v("panel-3"),
  studioPanelDividerActiveColor: v("lime"),
  studioPanelSectionBorderColor: v("panel-3"),
  studioPanelHeaderFontWeight: 600,
  studioPanelChevronButtonHoverBackgroundColor: v("panel-2"),
  studioPanelChevronButtonHoverColor: v("lime"),
  studioToggleButtonActiveBackgroundColor: v("panel-2"),
  studioToggleButtonActiveBorderColor: v("lime"),
  studioToggleButtonActiveColor: v("lime"),

  gridFontSize: 13,
  gridCellTextColor: v("cream"),
  gridHeaderBackgroundColor: v("panel"),
  gridHeaderTextColor: v("stone"),
  gridHeaderFontWeight: 600,
  gridHeaderFontSize: 12,
  gridRowHeight: 36,
  gridRowBorder: line("panel-3"),
  gridHeaderRowBorder: line("panel-3"),
  gridPinnedRowBorder: line("panel-3"),
  gridRowHoverColor: v("panel-2"),
  gridWrapperBorder: false,

  chartTextColor: v("cream"),
  chartSubtleTextColor: v("stone"),
  chartAxisLineColor: v("panel-3"),
  chartGridLineColor: v("panel-2"),
  ...palette,
});
