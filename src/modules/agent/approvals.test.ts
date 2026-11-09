import { generateText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { APPROVAL_TOOLS, approvalPolicy, decideApproval } from "./approvals";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

/** A model that calls `toolName` once, then says it's done — the 8 Nov regression in miniature. */
function modelCalling(toolName: string) {
  return new MockLanguageModelV4({
    doGenerate: [
      {
        content: [{ type: "tool-call", toolCallId: "call-1", toolName, input: "{}" }],
        finishReason: { unified: "tool-calls", raw: undefined },
        usage,
        warnings: [],
      },
      {
        content: [{ type: "text", text: "Done." }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      },
    ],
  });
}

describe("approval cards", () => {
  for (const name of APPROVAL_TOOLS) {
    it(`${name}: nothing happens before approval`, async () => {
      const ran: string[] = [];
      const result = await generateText({
        model: modelCalling(name),
        prompt: "do it",
        tools: { [name]: tool({ inputSchema: z.object({}), execute: async () => (ran.push(name), { ok: true }) }) },
        toolApproval: approvalPolicy(),
      });
      expect(ran).toEqual([]);
      const requests = result.content.filter((p) => p.type === "tool-approval-request");
      expect(requests).toHaveLength(1);
    });
  }

  it("a read tool runs without a card", async () => {
    const ran: string[] = [];
    await generateText({
      model: modelCalling("list_orders"),
      prompt: "show orders",
      tools: { list_orders: tool({ inputSchema: z.object({}), execute: async () => (ran.push("x"), []) }) },
      toolApproval: approvalPolicy(),
    });
    expect(ran).toEqual(["x"]);
  });

  it("settings can be stricter, never looser", () => {
    expect(decideApproval("refund_order", { refund_order: "always" })).toBe("user-approval");
    expect(decideApproval("list_orders", { list_orders: "approve" })).toBe("user-approval");
    expect(decideApproval("zapier_action", { zapier_action: "blocked" })).toMatchObject({ type: "denied" });
  });

  it("a blocked tool can't run", async () => {
    const ran: string[] = [];
    await generateText({
      model: modelCalling("zapier_action"),
      prompt: "export",
      tools: { zapier_action: tool({ inputSchema: z.object({}), execute: async () => (ran.push("x"), {}) }) },
      toolApproval: approvalPolicy({ zapier_action: "blocked" }),
    });
    expect(ran).toEqual([]);
  });
});
