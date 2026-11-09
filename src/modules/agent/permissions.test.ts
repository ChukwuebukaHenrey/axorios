import { generateText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { approvalPolicy } from "./approvals";
import { allowedPermissions, defaultPermission, effectivePermissions } from "./permissions";
import { gateTools } from "./registry";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

function modelCalling(toolName: string) {
  return new MockLanguageModelV4({
    doGenerate: [
      { content: [{ type: "tool-call", toolCallId: "call-1", toolName, input: "{}" }], finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [] },
      { content: [{ type: "text", text: "Done." }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] },
    ],
  });
}

function recordingTools(ran: string[]) {
  return {
    add_products: tool({ inputSchema: z.object({}), execute: async () => (ran.push("add_products"), { ok: true }) }),
    suggest_names: tool({ inputSchema: z.object({}), execute: async () => (ran.push("suggest_names"), ["A"]) }),
    sync_to_shopify: tool({ inputSchema: z.object({}), execute: async () => (ran.push("sync_to_shopify"), { ok: true }) }),
  };
}

describe("tool permissions", () => {
  it("defaults: read always, connection write needs approval, approval list asks, draft edits run", () => {
    expect(defaultPermission("suggest_names")).toBe("always");
    expect(defaultPermission("sync_to_shopify")).toBe("approve");
    expect(defaultPermission("refund_order")).toBe("approve");
    expect(defaultPermission("add_products")).toBe("always");
  });

  it("Settings offers only the default or stricter", () => {
    expect(allowedPermissions("refund_order")).toEqual(["approve", "blocked"]);
    expect(allowedPermissions("add_products")).toEqual(["always", "approve", "blocked"]);
  });

  it("strictest wins across account settings and connection rows; looser values are ignored", () => {
    const p = effectivePermissions({ refund_order: "always", add_products: "approve" }, { add_products: "blocked", bogus: "nope" });
    expect(p.refund_order).toBe("approve");
    expect(p.add_products).toBe("blocked");
    expect(p).not.toHaveProperty("bogus");
  });

  it("a Blocked tool is not in the registry and can't run", async () => {
    const ran: string[] = [];
    const permissions = effectivePermissions({ add_products: "blocked" });
    const tools = gateTools(recordingTools(ran), permissions);
    expect(Object.keys(tools)).not.toContain("add_products");
    await generateText({ model: modelCalling("add_products"), prompt: "add a cake", tools, toolApproval: approvalPolicy(permissions) }).catch(() => undefined);
    expect(ran).toEqual([]);
  });

  it("Needs approval set in Settings holds a normally free tool for a card", async () => {
    const ran: string[] = [];
    const permissions = effectivePermissions({ add_products: "approve" });
    const result = await generateText({
      model: modelCalling("add_products"),
      prompt: "add a cake",
      tools: gateTools(recordingTools(ran), permissions),
      toolApproval: approvalPolicy(permissions),
    });
    expect(ran).toEqual([]);
    expect(result.content.filter((p) => p.type === "tool-approval-request")).toHaveLength(1);
  });

  it("logs write tools after they run, not reads", async () => {
    const ran: string[] = [];
    const logged: string[] = [];
    const tools = gateTools(recordingTools(ran), effectivePermissions(), ({ toolName }) => void logged.push(toolName));
    await generateText({ model: modelCalling("add_products"), prompt: "x", tools, toolApproval: approvalPolicy() });
    await generateText({ model: modelCalling("suggest_names"), prompt: "x", tools, toolApproval: approvalPolicy() });
    expect(ran).toEqual(["add_products", "suggest_names"]);
    expect(logged).toEqual(["add_products"]);
  });
});
