/**
 * Which tool calls wait for the seller's Approve before they run (spec v2, "Approval cards").
 * Pure: no server imports, so tests and the UI can read it.
 */

/** Every tool that changes something outside the draft or spends money. New tools of these kinds must be added here. */
export const APPROVAL_TOOLS = [
  "publish_store",
  "schedule_posts",
  "send_campaign",
  "connect_shopify",
  "sync_to_shopify",
  "create_payment_link",
  "refund_order",
  "import_products",
  "apply_template_to_stores",
  "zapier_action",
  "log_expense",
  "create_store",
] as const;

export type ApprovalTool = (typeof APPROVAL_TOOLS)[number];

/** Per-tool seller setting from Settings › Connections and Axori AI strictness. */
export type ToolPermission = "always" | "approve" | "blocked";

export type ApprovalDecision = "user-approval" | { type: "denied"; reason: string } | undefined;

export function requiresApproval(toolName: string): boolean {
  return (APPROVAL_TOOLS as readonly string[]).includes(toolName);
}

/**
 * The seller can make a tool stricter (approve, blocked), never looser:
 * "always" on an approval tool still asks.
 */
export function decideApproval(toolName: string, permissions: Record<string, ToolPermission> = {}): ApprovalDecision {
  const set = permissions[toolName];
  if (set === "blocked") return { type: "denied", reason: "The seller blocked this action in Settings" };
  if (requiresApproval(toolName) || set === "approve") return "user-approval";
  return undefined;
}

/** For `streamText({ toolApproval })`: a generic policy, so a tool added later can't skip the list by omission. */
export function approvalPolicy(permissions: Record<string, ToolPermission> = {}) {
  return ({ toolCall }: { toolCall: { toolName: string } }) => decideApproval(toolCall.toolName, permissions);
}
