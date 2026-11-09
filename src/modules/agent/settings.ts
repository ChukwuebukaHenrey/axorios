import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import type { ToolPermission } from "./approvals";
import { allowedPermissions, catalogEntry, effectivePermissions, TOOL_CATALOG } from "./permissions";

type Actor = "seller" | "axori_ai" | "system";

/** One row in the activity log. Never throws: a failed log line must not undo the action it describes. */
export async function logActivity(entry: {
  ownerId: string;
  storeId?: string | null;
  actor: Actor;
  action: string;
  target?: string | null;
  approvalId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  await serviceRoleClient()
    .from("activity_log")
    .insert({
      owner_id: entry.ownerId,
      store_id: entry.storeId ?? null,
      actor: entry.actor,
      action: entry.action,
      target: entry.target ?? null,
      approval_id: entry.approvalId ?? null,
      details: (entry.details ?? {}) as Json,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

/**
 * The permissions the agent runs with: defaults, then the owner's Settings, then the store's connection rows.
 * Strictest wins. Read with the service role inside a call that already has `ownerId` from the session.
 */
export async function toolPermissionsFor(ownerId: string, storeId?: string | null): Promise<Record<string, ToolPermission>> {
  const db = serviceRoleClient();
  const [settings, connections] = await Promise.all([
    db.from("account_settings").select("tool_permissions").eq("owner_id", ownerId).maybeSingle(),
    storeId
      ? db.from("platform_connections").select("permissions").or(`store_id.eq.${storeId},and(owner_id.eq.${ownerId},scope.eq.account)`)
      : db.from("platform_connections").select("permissions").eq("owner_id", ownerId).eq("scope", "account"),
  ]);
  if (settings.error) throw new Error(`Settings read failed: ${settings.error.code}`);
  if (connections.error) throw new Error(`Connections read failed: ${connections.error.code}`);
  return effectivePermissions(settings.data?.tool_permissions, ...(connections.data ?? []).map((c) => c.permissions));
}

export async function getAccountSettings(supabase: SupabaseClient<Database>, ownerId: string) {
  const { data, error } = await supabase.from("account_settings").select("display_name, tool_permissions").eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Error(`Settings read failed: ${error.code}`);
  return { displayName: data?.display_name ?? null, permissions: effectivePermissions(data?.tool_permissions) };
}

/** Settings › Axori AI and Connections. Refuses a value looser than the default. */
export async function setToolPermission(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  toolName: string,
  value: ToolPermission,
): Promise<{ ok: boolean }> {
  if (!catalogEntry(toolName) || !allowedPermissions(toolName).includes(value)) return { ok: false };
  const { data } = await supabase.from("account_settings").select("tool_permissions").eq("owner_id", ownerId).maybeSingle();
  const current = (data?.tool_permissions ?? {}) as Record<string, ToolPermission>;
  const { error } = await supabase
    .from("account_settings")
    .upsert({ owner_id: ownerId, tool_permissions: { ...current, [toolName]: value }, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Settings save failed: ${error.code}`);
  await logActivity({ ownerId, actor: "seller", action: "set_permission", target: toolName, details: { permission: value } });
  return { ok: true };
}

export async function setDisplayName(supabase: SupabaseClient<Database>, ownerId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("account_settings")
    .upsert({ owner_id: ownerId, display_name: name || null, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Settings save failed: ${error.code}`);
}

export type ActivityRow = { id: number; at: string; actor: string; action: string; target: string | null; storeId: string | null; approvalId: string | null };

/** Newest first, RLS-scoped to the signed-in owner. */
export async function listActivity(supabase: SupabaseClient<Database>, opts: { limit?: number; before?: string } = {}): Promise<ActivityRow[]> {
  let query = supabase
    .from("activity_log")
    .select("id, at, actor, action, target, store_id, approval_id")
    .order("at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.before) query = query.lt("at", opts.before);
  const { data, error } = await query;
  if (error) throw new Error(`Activity read failed: ${error.code}`);
  return data.map((r) => ({ id: r.id, at: r.at, actor: r.actor, action: r.action, target: r.target, storeId: r.store_id, approvalId: r.approval_id }));
}

const UNUSED_AFTER_MS = 30 * 24 * 3600 * 1000;

/**
 * Last time Axori AI ran each tool, for "last used", and the catalog tools not run in 30 days
 * (spec: flag permissions unused for 30 days).
 */
export async function toolUsage(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  /** Use recorded elsewhere, e.g. Shopify's last sync. */
  extra: Record<string, string | null | undefined> = {},
): Promise<{ lastUsed: Record<string, string>; unused: string[] }> {
  const lastUsed = await lastUsedByTool(supabase, ownerId);
  for (const [name, at] of Object.entries(extra)) if (at && (!lastUsed[name] || at > lastUsed[name])) lastUsed[name] = at;
  const cutoff = Date.now() - UNUSED_AFTER_MS;
  const unused = TOOL_CATALOG.map((t) => t.name).filter((name) => !lastUsed[name] || Date.parse(lastUsed[name]) < cutoff);
  return { lastUsed, unused };
}

async function lastUsedByTool(supabase: SupabaseClient<Database>, ownerId: string): Promise<Record<string, string>> {
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("activity_log")
    .select("action, at")
    .eq("owner_id", ownerId)
    .eq("actor", "axori_ai")
    .gte("at", since)
    .order("at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Activity read failed: ${error.code}`);
  const out: Record<string, string> = {};
  // Refunds write their own line as "refund".
  for (const r of data) out[r.action === "refund" ? "refund_order" : r.action] ??= r.at;
  return out;
}
