/**
 * The tool registry gate (6.12). Every agent turn's tools pass through here:
 * Blocked tools are removed, and each action that changes something is logged after it runs.
 * Pure apart from the `log` callback, so tests can drive it with a mock model.
 */
import type { ToolSet } from "ai";
import type { ToolPermission } from "./approvals";
import { catalogEntry, withoutBlocked } from "./permissions";

export type ToolRunLog = (entry: { toolName: string; toolCallId: string; ok: boolean }) => Promise<void> | void;

/** Tools that write their own activity line with richer details. */
const SELF_LOGGING = new Set(["refund_order", "create_store", "zapier_action"]);

export function gateTools<T extends ToolSet>(tools: T, permissions: Record<string, ToolPermission>, log?: ToolRunLog): T {
  const allowed = withoutBlocked(tools, permissions) as ToolSet;
  if (!log) return allowed as T;
  const out: ToolSet = {};
  for (const [name, t] of Object.entries(allowed)) {
    const kind = catalogEntry(name)?.kind;
    if (!t.execute || !kind || kind === "read" || SELF_LOGGING.has(name)) {
      out[name] = t;
      continue;
    }
    const execute = t.execute;
    out[name] = {
      ...t,
      execute: async (input: unknown, options: { toolCallId: string }) => {
        const result = await execute(input as never, options as never);
        const ok = !(result && typeof result === "object" && "error" in result);
        await log({ toolName: name, toolCallId: options.toolCallId, ok });
        return result;
      },
    } as ToolSet[string];
  }
  return out as T;
}
