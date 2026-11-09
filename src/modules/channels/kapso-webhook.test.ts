import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { classifyKapsoFailure, KAPSO_MESSAGE_RECEIVED, parseKapsoWebhook, verifyKapsoSignature, WHATSAPP_WINDOW_MS } from "./kapso-webhook";
import { windowOpen } from "./whatsapp-templates";

const at = "2026-11-10T00:00:00.000Z";
const secret = "test-secret";
const sign = (body: string, key = secret) => createHmac("sha256", key).update(body).digest("hex");

const event = (text: string, extra: Record<string, unknown> = {}) => ({
  message: { id: "wamid.1", timestamp: "1762732800", type: "text", from: "2348012345678", text: { body: text }, kapso: { direction: "inbound" }, ...extra },
  conversation: { id: "conv_1", phone_number: "2348012345678" },
  phone_number_id: "123",
});

describe("verifyKapsoSignature", () => {
  const body = JSON.stringify(event("hi"));

  it("accepts Kapso's hex HMAC of the raw body", () => {
    expect(verifyKapsoSignature(body, sign(body), secret)).toBe(true);
  });

  it("rejects a forged, missing, wrong-length or re-serialised signature, and any request when no secret is set", () => {
    expect(verifyKapsoSignature(body, sign(body, "other"), secret)).toBe(false);
    expect(verifyKapsoSignature(body, null, secret)).toBe(false);
    expect(verifyKapsoSignature(body, "abcd", secret)).toBe(false);
    expect(verifyKapsoSignature(`${body} `, sign(body), secret)).toBe(false);
    expect(verifyKapsoSignature(body, sign(body), undefined)).toBe(false);
  });
});

describe("parseKapsoWebhook", () => {
  it("reads an inbound text and sets the 24 h window from the message time", () => {
    const [m] = parseKapsoWebhook(event("Do you deliver to Lekki?"), KAPSO_MESSAGE_RECEIVED, at);
    expect(m).toMatchObject({ channel: "whatsapp", eventId: "wamid.1", customerRef: "2348012345678", text: "Do you deliver to Lekki?" });
    expect(new Date(m.windowEndsAt!).getTime()).toBe(1762732800 * 1000 + WHATSAPP_WINDOW_MS);
  });

  it("reads `start <slug>` as a store binding, and nothing unsafe as a slug", () => {
    const start = (text: string) => parseKapsoWebhook(event(text), KAPSO_MESSAGE_RECEIVED, at)[0];
    expect(start("start eko-sweet-bakes").start).toEqual({ slug: "eko-sweet-bakes" });
    expect(start("START Eko-Sweet-Bakes").start).toEqual({ slug: "eko-sweet-bakes" });
    expect(start("/start demo").start).toEqual({ slug: "demo" });
    expect(start("start").start).toEqual({ slug: null });
    expect(start("start ../../etc").start).toEqual({ slug: null });
    expect(start("please start demo").start).toBeUndefined();
  });

  it("unpacks a buffered batch", () => {
    const batch = { type: KAPSO_MESSAGE_RECEIVED, batch: true, data: [event("one"), { ...event("two"), message: { ...event("two").message, id: "wamid.2" } }] };
    expect(parseKapsoWebhook(batch, KAPSO_MESSAGE_RECEIVED, at).map((m) => m.eventId)).toEqual(["wamid.1", "wamid.2"]);
  });

  it("falls back to the business-scoped user ID when there's no phone", () => {
    const e = event("hi", { from: undefined, from_user_id: "US.1" });
    const [m] = parseKapsoWebhook({ ...e, conversation: {} }, KAPSO_MESSAGE_RECEIVED, at);
    expect(m.customerRef).toBe("bsuid:US.1");
  });

  it("ignores other events, outbound echoes, media-only text and junk", () => {
    expect(parseKapsoWebhook(event("hi"), "whatsapp.message.sent", at)).toEqual([]);
    expect(parseKapsoWebhook(event("hi", { kapso: { direction: "outbound" } }), KAPSO_MESSAGE_RECEIVED, at)).toEqual([]);
    expect(parseKapsoWebhook(event("x", { type: "image" }), KAPSO_MESSAGE_RECEIVED, at)[0].text).toBeUndefined();
    expect(parseKapsoWebhook(null, KAPSO_MESSAGE_RECEIVED, at)).toEqual([]);
    expect(parseKapsoWebhook({ nonsense: true }, KAPSO_MESSAGE_RECEIVED, at)).toEqual([]);
  });
});

describe("classifyKapsoFailure", () => {
  it("spots credit failures and the closed window", () => {
    expect(classifyKapsoFailure(402, { error: "Your Kapso balance doesn't cover Meta's fee", code: "insufficient_credits" })).toBe("credits");
    expect(classifyKapsoFailure(422, { error: { message: "outside window", code: 131047 } })).toBe("window");
    expect(classifyKapsoFailure(422, { error: "opted out", code: "marketing_preference_stopped" })).toBe("other");
    expect(classifyKapsoFailure(500, null)).toBe("other");
  });
});

describe("windowOpen", () => {
  it("is open only before the end time, and closed when unknown", () => {
    const now = Date.parse(at);
    expect(windowOpen("2026-11-10T01:00:00.000Z", now)).toBe(true);
    expect(windowOpen("2026-11-09T23:59:00.000Z", now)).toBe(false);
    expect(windowOpen(null, now)).toBe(false);
  });
});
