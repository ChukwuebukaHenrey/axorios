import { describe, expect, it } from "vitest";
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

describe("isChargeable", () => {
  it("knows what PayPal can charge", () => {
    expect(isChargeable("GBP")).toBe(true);
    expect(isChargeable("jpy")).toBe(true);
    expect(isChargeable("NGN")).toBe(false);
    expect(isChargeable("GHS")).toBe(false);
    expect(isChargeable("KES")).toBe(false);
  });
});
