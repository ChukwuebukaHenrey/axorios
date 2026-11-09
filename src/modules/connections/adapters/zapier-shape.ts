/**
 * Pure helpers for Zapier MCP replies, kept apart from the client so tests can feed them recorded replies.
 */
import { ConnectionError, EXPORT_FIELDS, type ExportRow } from "../export-orders";

type ToolResult = { isError?: boolean; content?: unknown; structuredContent?: unknown };

/** The JSON a Zapier meta tool returned: structured content if present, else the first text block parsed. */
export function resultJson(result: ToolResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const blocks = Array.isArray(result.content) ? (result.content as { type?: string; text?: string }[]) : [];
  const text = blocks.find((b) => b.type === "text")?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** A Zapier tool call can "succeed" at the protocol level and still carry an error. Throw so it is classified. */
export function assertOk(result: ToolResult): unknown {
  const json = resultJson(result);
  const err =
    result.isError ||
    (json && typeof json === "object" && ("error" in json || "errors" in json || (json as { status?: unknown }).status === "error"));
  if (err) {
    const detail = typeof json === "string" ? json : JSON.stringify(json);
    throw new Error(`Zapier error: ${detail.slice(0, 500)}`);
  }
  return json;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Finds `dynamic_properties_schema.properties` anywhere in an inspect reply. */
function findProperties(node: unknown, depth = 0): Record<string, unknown> | null {
  if (!node || typeof node !== "object" || depth > 6) return null;
  const rec = node as Record<string, unknown>;
  const schema = rec.dynamic_properties_schema as { properties?: unknown } | undefined;
  if (schema && typeof schema.properties === "object" && schema.properties) return schema.properties as Record<string, unknown>;
  for (const value of Array.isArray(node) ? node : Object.values(rec)) {
    const found = findProperties(value, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Maps our column headers to Zapier's field keys (like `COL$A`) by the header text Zapier reports.
 * Matching by header, not position, means a reordered sheet still gets each value in the right column.
 */
export function columnKeys(inspectReply: unknown): Record<string, string> {
  const props = findProperties(inspectReply);
  if (!props) throw new ConnectionError("sheet_columns_missing", "Zapier returned no columns for this worksheet");
  const byHeader = new Map<string, string>();
  for (const [key, raw] of Object.entries(props)) {
    const p = (raw ?? {}) as { title?: unknown; label?: unknown; description?: unknown };
    const header = [p.title, p.label, p.description].find((v): v is string => typeof v === "string" && v.trim() !== "");
    if (header && !byHeader.has(norm(header))) byHeader.set(norm(header), key);
  }
  const missing = EXPORT_FIELDS.filter((f) => !byHeader.has(norm(f)));
  if (missing.length > 0) throw new ConnectionError("sheet_columns_missing", missing.join(", "));
  return Object.fromEntries(EXPORT_FIELDS.map((f) => [f, byHeader.get(norm(f))!]));
}

export function rowProperties(keys: Record<string, string>, row: ExportRow): Record<string, string> {
  return Object.fromEntries(EXPORT_FIELDS.map((f) => [keys[f], row[f]]));
}
