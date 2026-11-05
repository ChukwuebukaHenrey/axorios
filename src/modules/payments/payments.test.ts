import { describe, expect, it } from "vitest";
import { convertMinor, lockRate } from "./convert";
import { isChargeable } from "./currency";
import { parsePayPalEvent } from "./webhook-event";

function event(event_type: string, resource: unknown) {
  return JSON.stringify({ id: "WH-1", event_type, resource });
}

describe("parsePayPalEvent", () => {
  it("reads the order from an approval", () => {
    expect(parsePayPalEvent(event("CHECKOUT.ORDER.APPROVED", { id: "ORDER1" }))).toEqual({
      eventId: "WH-1",
      type: "CHECKOUT.ORDER.APPROVED",
      providerOrderId: "ORDER1",
    });
  });

  it("reads the order from a completed capture, not the capture's own ID", () => {
    const parsed = parsePayPalEvent(
      event("PAYMENT.CAPTURE.COMPLETED", { id: "CAPTURE1", supplementary_data: { related_ids: { order_id: "ORDER1" } } }),
    );
    expect(parsed?.providerOrderId).toBe("ORDER1");
  });

  it("leaves other events with nothing to settle", () => {
    expect(parsePayPalEvent(event("PAYMENT.CAPTURE.REFUNDED", { id: "CAPTURE1" }))?.providerOrderId).toBeNull();
  });

  it("refuses a body that isn't an event", () => {
    expect(parsePayPalEvent("not json")).toBeNull();
    expect(parsePayPalEvent(JSON.stringify({ hello: "world" }))).toBeNull();
  });
});

describe("convertMinor", () => {
  it("converts naira to dollars at a locked rate", () => {
    const rate = lockRate(1 / 1346);
    expect(convertMinor(4_500_000, "NGN", "USD", rate)).toBe(3343);
  });

  it("respects currencies with no decimals or three", () => {
    expect(convertMinor(1000, "JPY", "USD", 0.0065)).toBe(650); // ¥1,000 = $6.50
    expect(convertMinor(650, "USD", "JPY", 153.8)).toBe(1000); // $6.50 = ¥999.7, rounded to whole yen
    expect(convertMinor(1000, "KWD", "USD", 3.25)).toBe(325); // 1.000 KWD = $3.25
  });

  it("gets the same charge back from the stored rate", () => {
    const stored = Number(lockRate(0.000742942050520059).toString());
    expect(convertMinor(4_500_000, "NGN", "USD", stored)).toBe(convertMinor(4_500_000, "NGN", "USD", lockRate(0.000742942050520059)));
    expect(String(stored).split(".")[1].length).toBeLessThanOrEqual(10);
  });

  it("refuses an unusable rate", () => {
    expect(() => lockRate(0)).toThrow();
    expect(() => lockRate(Number.NaN)).toThrow();
    expect(() => lockRate(0.00000000001)).toThrow();
  });
});

describe("isChargeable", () => {
  it("knows what PayPal can charge", () => {
    expect(isChargeable("GBP")).toBe(true);
    expect(isChargeable("jpy")).toBe(true);
    expect(isChargeable("NGN")).toBe(false);
    expect(isChargeable("GHS")).toBe(false);
    expect(isChargeable("KES")).toBe(false);
  });
});
