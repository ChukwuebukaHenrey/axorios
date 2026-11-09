import type { ExportRow } from "./export-orders";

/** Where a sheet export lands. Comes from server config, never from the model. */
export type SheetDestination = { spreadsheetId: string; worksheetId: string; label: string };

/** A seller-side app connection (spec: `AppConnection`). Zapier is the only adapter in this build. */
export interface AppConnection {
  readonly id: "zapier";
  /** Appends one row. Throws on any failure; the caller classifies it. */
  addSheetRow(destination: SheetDestination, row: ExportRow): Promise<void>;
  close(): Promise<void>;
}
