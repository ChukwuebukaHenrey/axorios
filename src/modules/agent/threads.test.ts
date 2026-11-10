import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service-role", () => ({ serviceRoleClient: () => ({}) }));
vi.mock("./session", () => ({ loadSellerSession: async () => [] }));

const { createThread, hasSellerMessage, titleFrom } = await import("./threads");

const user = (text: string): UIMessage => ({ id: "u", role: "user", parts: [{ type: "text", text }] });
const assistant: UIMessage = { id: "a", role: "assistant", parts: [{ type: "text", text: "Hi!" }] };

describe("chat threads are saved only with a first message", () => {
  it("counts only the seller's own messages", () => {
    expect(hasSellerMessage([])).toBe(false);
    expect(hasSellerMessage([assistant])).toBe(false);
    expect(hasSellerMessage([user("Plan a promo")])).toBe(true);
  });

  it("writes nothing for a chat with no seller message", async () => {
    const insert = vi.fn();
    const supabase = { from: () => ({ insert }) } as never;
    expect(await createThread(supabase, "owner", "store", { id: crypto.randomUUID(), messages: [assistant] })).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it("creates the row with the first message and its title in one insert", async () => {
    const id = crypto.randomUUID();
    let row: Record<string, unknown> = {};
    const supabase = {
      from: () => ({
        insert: (r: Record<string, unknown>) => {
          row = r;
          return { select: () => ({ single: async () => ({ data: { ...r, updated_at: "now" }, error: null }) }) };
        },
      }),
    } as never;
    const thread = await createThread(supabase, "owner", "store", { id, messages: [user("How is the shop doing this month?")] });
    expect(row).toMatchObject({ id, owner_id: "owner", store_id: "store", title: titleFrom([user("How is the shop doing this month?")]) });
    expect((row.messages as UIMessage[]).length).toBe(1);
    expect(thread?.id).toBe(id);
  });

  it("answers null when the id is already taken, so the route can 404", async () => {
    const supabase = {
      from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: "23505" } }) }) }) }),
    } as never;
    expect(await createThread(supabase, "owner", "store", { id: crypto.randomUUID(), messages: [user("Hi")] })).toBeNull();
  });
});
