import { describe, expect, it } from "vitest";
import { parseTelegramUpdate } from "./telegram-update";

const at = "2026-11-05T00:00:00.000Z";
const update = (message: unknown) => ({ update_id: 7, message });

describe("parseTelegramUpdate", () => {
  it("reads a private text message", () => {
    const [m] = parseTelegramUpdate(update({ chat: { id: 42, type: "private" }, text: "hi" }), at);
    expect(m).toEqual({ channel: "telegram", eventId: "7", customerRef: "42", text: "hi", receivedAt: at });
  });

  it("uses a photo's caption as the text", () => {
    const [m] = parseTelegramUpdate(update({ chat: { id: 42, type: "private" }, caption: "this one" }), at);
    expect(m.text).toBe("this one");
  });

  it("ignores groups, updates with no message, and malformed bodies", () => {
    expect(parseTelegramUpdate(update({ chat: { id: 42, type: "group" }, text: "hi" }), at)).toEqual([]);
    expect(parseTelegramUpdate({ update_id: 7 }, at)).toEqual([]);
    expect(parseTelegramUpdate(null, at)).toEqual([]);
    expect(parseTelegramUpdate({ nonsense: true }, at)).toEqual([]);
  });
});
