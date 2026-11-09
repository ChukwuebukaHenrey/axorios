import "server-only";
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ExportRow } from "../export-orders";
import type { AppConnection, SheetDestination } from "../types";
import { assertOk, columnKeys, rowProperties } from "./zapier-shape";

/** Zapier's Google Sheets "Create Spreadsheet Row" action, read from Zapier MCP on 9 Nov. */
const SHEETS_API = "GoogleSheetsV2CLIAPI";
const ADD_ROW = "add_row";
const ADD_ROW_TOOL = "google_sheets_create_spreadsheet_row";
const TIMEOUT_MS = 20_000;

/** Column keys per worksheet. Reading them costs a call, and headers rarely change. */
const columnCache = new Map<string, Record<string, string>>();

/**
 * Zapier MCP over streamable HTTP, through the server's meta tools (`inspect_zapier_actions`,
 * `execute_zapier_write_action`). One server owned by the demo account; per-seller Zapier is roadmap.
 */
export function zapierConnection(url: string, token: string): AppConnection {
  let client: Promise<MCPClient> | undefined;
  const open = () =>
    (client ??= createMCPClient({
      transport: { type: "http", url, headers: { Authorization: `Bearer ${token}` } },
      clientName: "axorios",
      initializationOptions: { timeout: TIMEOUT_MS },
    }));

  const call = async (name: string, args: Record<string, unknown>) =>
    assertOk((await (await open()).callTool({ name, arguments: args, options: { timeout: TIMEOUT_MS } })) as Parameters<typeof assertOk>[0]);

  async function keysFor(d: SheetDestination) {
    const cacheKey = `${d.spreadsheetId}|${d.worksheetId}`;
    const cached = columnCache.get(cacheKey);
    if (cached) return cached;
    const reply = await call("inspect_zapier_actions", {
      tool_name: ADD_ROW_TOOL,
      params: { spreadsheet: d.spreadsheetId, worksheet: d.worksheetId },
    });
    const keys = columnKeys(reply);
    columnCache.set(cacheKey, keys);
    return keys;
  }

  return {
    id: "zapier",
    async addSheetRow(destination: SheetDestination, row: ExportRow) {
      const keys = await keysFor(destination);
      await call("execute_zapier_write_action", {
        selected_api: SHEETS_API,
        action: ADD_ROW,
        params: {
          spreadsheet: destination.spreadsheetId,
          worksheet: destination.worksheetId,
          dynamic_properties: rowProperties(keys, row),
        },
      });
    },
    async close() {
      if (client) await (await client.catch(() => null))?.close();
      client = undefined;
    },
  };
}
