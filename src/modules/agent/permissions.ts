/**
 * Per-tool permissions (spec v2, "Connections page" and "Axori AI" settings).
 * Pure: no server imports, so the Settings UI, the registry and tests share it.
 */
import { requiresApproval, type ToolPermission } from "./approvals";

export type ToolKind = "read" | "write" | "delete";
export type ConnectionId = "shopify" | "paypal" | "zapier";

type CatalogEntry = { name: string; kind: ToolKind; connection?: ConnectionId };

/** Every seller-side tool a seller can set. `offer_choices` and `show_transcript` only show things, so they're always on. */
export const TOOL_CATALOG: readonly CatalogEntry[] = [
  { name: "create_store", kind: "write" },
  { name: "create_brand_kit", kind: "write" },
  { name: "update_brand_kit", kind: "write" },
  { name: "suggest_names", kind: "read" },
  { name: "add_products", kind: "write" },
  { name: "set_currency", kind: "write" },
  { name: "edit_site", kind: "write" },
  { name: "revert_site", kind: "write" },
  { name: "choose_template", kind: "write" },
  { name: "generate_campaign", kind: "write" },
  { name: "schedule_posts", kind: "write" },
  { name: "publish_store", kind: "write" },
  { name: "log_expense", kind: "write" },
  { name: "connect_shopify", kind: "write", connection: "shopify" },
  { name: "sync_to_shopify", kind: "write", connection: "shopify" },
  { name: "refund_order", kind: "write", connection: "paypal" },
  { name: "zapier_action", kind: "write", connection: "zapier" },
];

const RANK: Record<ToolPermission, number> = { always: 0, approve: 1, blocked: 2 };
const isPermission = (v: unknown): v is ToolPermission => v === "always" || v === "approve" || v === "blocked";

export function catalogEntry(name: string): CatalogEntry | undefined {
  return TOOL_CATALOG.find((t) => t.name === name);
}

export function toolsFor(connection: ConnectionId): CatalogEntry[] {
  return TOOL_CATALOG.filter((t) => t.connection === connection);
}

/**
 * Defaults. Connection tools: read = Always allow, write = Needs approval, delete = Blocked.
 * Axori AI's own tools keep today's behaviour: the approval list asks, draft edits run.
 */
export function defaultPermission(name: string): ToolPermission {
  const entry = catalogEntry(name);
  if (entry?.kind === "delete") return "blocked";
  if (requiresApproval(name)) return "approve";
  if (entry?.connection && entry.kind === "write") return "approve";
  return "always";
}

/** The choices Settings offers: the default and anything stricter, never looser. */
export function allowedPermissions(name: string): ToolPermission[] {
  const floor = RANK[defaultPermission(name)];
  return (["always", "approve", "blocked"] as const).filter((p) => RANK[p] >= floor);
}

/** Strictest of the default and every stored map (account settings, a connection row). Unknown values are ignored. */
export function effectivePermissions(...maps: unknown[]): Record<string, ToolPermission> {
  const out: Record<string, ToolPermission> = {};
  for (const { name } of TOOL_CATALOG) out[name] = defaultPermission(name);
  for (const map of maps) {
    if (!map || typeof map !== "object") continue;
    for (const [name, value] of Object.entries(map as Record<string, unknown>)) {
      if (!isPermission(value)) continue;
      const current = out[name] ?? defaultPermission(name);
      out[name] = RANK[value] > RANK[current] ? value : current;
    }
  }
  return out;
}

/** The registry: a Blocked tool isn't handed to the model at all, so it can't be called. */
export function withoutBlocked<T extends Record<string, unknown>>(tools: T, permissions: Record<string, ToolPermission>): Partial<T> {
  return Object.fromEntries(Object.entries(tools).filter(([name]) => permissions[name] !== "blocked")) as Partial<T>;
}

export function blockedTools(permissions: Record<string, ToolPermission>): string[] {
  return Object.entries(permissions)
    .filter(([, p]) => p === "blocked")
    .map(([name]) => name);
}
