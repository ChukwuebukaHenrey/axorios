import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TOOL_CATALOG } from "./permissions";
import { salesTools } from "./sales";

/** Spec v2: the sales agent reads customer messages, so it never gets connection tools (Zapier above all). */
describe("sales agent tools", () => {
  const store = { storeId: "00000000-0000-4000-8000-000000000001", slug: "demo" } as Parameters<typeof salesTools>[0];
  const names = Object.keys(salesTools(store, { channel: "telegram", customerRef: "1" }, new Map()));

  it("is exactly the read-only lookup plus create_order and send_payment_link", () => {
    expect(names.sort()).toEqual(["create_order", "search_products", "send_payment_link"]);
  });

  it("has no Zapier tool and no connection tool of any kind", () => {
    expect(names).not.toContain("zapier_action");
    expect(names.some((n) => /zapier|connection|mcp/i.test(n))).toBe(false);
    const connectionTools = TOOL_CATALOG.filter((t) => t.connection).map((t) => t.name);
    expect(connectionTools).toContain("zapier_action");
    for (const name of connectionTools) expect(names).not.toContain(name);
  });

  it("never imports the connections module", () => {
    const source = readFileSync(join(__dirname, "sales.ts"), "utf8");
    expect(source).not.toMatch(/modules\/connections|@ai-sdk\/mcp/);
  });
});
