// Plain constants for the paged table widget (paged-grid.tsx), shared with the report and phone layout without
// pulling React or Studio's React bindings into them.

/** Studio widget type of the paged table. */
export const PAGED_GRID = "paged-grid";
/** Rows per page. A list at or under this length shows no pager. */
export const PAGE_SIZE = 15;
/** Canvas tracks a paged table needs for a full page, its header, Total row and pager. */
export const PAGED_GRID_SPAN = 40;
/** On phones the pager stacks its row count above the buttons, so the card needs a few more tracks. */
export const PHONE_PAGER_EXTRA = 3;
/** Canvas tracks for a short paged table (a handful of rows, e.g. one per channel): header, rows and Total, no scroller. */
export const SHORT_GRID_SPAN = 26;
