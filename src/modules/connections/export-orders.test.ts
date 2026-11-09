import { describe, expect, it } from "vitest";
import { assertOk, columnKeys, resultJson, rowProperties } from "./adapters/zapier-shape";
import { classifyZapierError, ConnectionError, EXPORT_FIELDS, orderRow } from "./export-orders";

const order = {
  id: "3920970b-1111-4222-8333-444455556666",
  created_at: "2026-11-05T21:00:00Z",
  paid_at: "2026-11-05T22:06:00Z",
  status: "paid",
  channel: "telegram",
  items: [
    { productId: "p1", name: "Red Velvet Cake", quantity: 1, unitMinor: 4500000, lineMinor: 4500000 },
    { productId: "p2", name: "Chin Chin Jar", quantity: 2, unitMinor: 750000, lineMinor: 1500000 },
  ],
  total_minor: 6000000,
  currency: "NGN",
  charge_total_minor: 4458,
  charge_currency: "USD",
  buyer_country: "GB",
};

describe("orderRow", () => {
  it("sends exactly the listed fields, amounts as plain decimals", () => {
    const row = orderRow(order);
    expect(Object.keys(row)).toEqual([...EXPORT_FIELDS]);
    expect(row).toEqual({
      Order: "3920970b",
      Date: "2026-11-05",
      Status: "paid",
      Channel: "telegram",
      Items: "1 x Red Velvet Cake, 2 x Chin Chin Jar",
      Total: "60000.00",
      Currency: "NGN",
      Charged: "44.58",
      "Charged currency": "USD",
      Country: "GB",
    });
  });

  it("keeps zero-decimal currencies whole and tolerates a missing country", () => {
    const row = orderRow({ ...order, currency: "JPY", total_minor: 4500, charge_currency: "JPY", charge_total_minor: 4500, buyer_country: null });
    expect(row.Total).toBe("4500");
    expect(row.Charged).toBe("4500");
    expect(row.Country).toBe("");
  });

  it("carries no email, phone or delivery address", () => {
    const row = JSON.stringify(orderRow({ ...order, delivery_note: "Ada, 5 Allen Ave, 08031234567" } as typeof order));
    expect(row).not.toMatch(/Allen|0803|@/);
  });
});

describe("classifyZapierError", () => {
  it("tells quota, auth and outage apart", () => {
    expect(classifyZapierError(Object.assign(new Error("x"), { statusCode: 429 }))).toBe("zapier_quota");
    expect(classifyZapierError(new Error('Zapier error: {"error":"Task limit reached for this billing period"}'))).toBe("zapier_quota");
    expect(classifyZapierError(Object.assign(new Error("x"), { status: 401 }))).toBe("zapier_auth");
    expect(classifyZapierError(new Error("Please reconnect your Google Sheets account"))).toBe("zapier_auth");
    expect(classifyZapierError(new TypeError("fetch failed"))).toBe("zapier_unavailable");
    expect(classifyZapierError(Object.assign(new Error("x"), { statusCode: 503 }))).toBe("zapier_unavailable");
    expect(classifyZapierError(new Error("Request timed out"))).toBe("zapier_unavailable");
    expect(classifyZapierError(new Error("Invalid value for spreadsheet"))).toBe("zapier_failed");
    expect(classifyZapierError(new ConnectionError("sheet_columns_missing"))).toBe("sheet_columns_missing");
  });
});

describe("Zapier MCP replies", () => {
  const inspect = {
    content: [
      {
        type: "text",
        text: JSON.stringify([
          {
            tool_name: "google_sheets_create_spreadsheet_row",
            dynamic_properties_schema: {
              type: "object",
              // Sheet columns in a different order from ours, and one extra column.
              properties: Object.fromEntries(
                ["Notes", ...[...EXPORT_FIELDS].reverse()].map((h, i) => [`COL$${String.fromCharCode(65 + i)}`, { type: "string", title: h }]),
              ),
            },
          },
        ]),
      },
    ],
  };

  it("maps each field to its column by header, not position", () => {
    const keys = columnKeys(resultJson(inspect));
    expect(keys.Country).toBe("COL$B");
    expect(keys.Order).toBe("COL$K");
    const props = rowProperties(keys, orderRow(order));
    expect(props["COL$K"]).toBe("3920970b");
    expect(props["COL$A"]).toBeUndefined();
  });

  it("refuses a sheet without our headers, naming what's missing", () => {
    const reply = { dynamic_properties_schema: { properties: { "COL$A": { title: "Order" } } } };
    expect(() => columnKeys(reply)).toThrow(/sheet_columns_missing: Date, Status/);
  });

  it("treats a tool-level error as a failure", () => {
    expect(() => assertOk({ isError: true, content: [{ type: "text", text: "Rate limit exceeded" }] })).toThrow(/Rate limit/);
    expect(() => assertOk({ content: [{ type: "text", text: '{"error":"quota"}' }] })).toThrow(/quota/);
    expect(assertOk({ content: [{ type: "text", text: '{"results":[{"id":1}]}' }] })).toEqual({ results: [{ id: 1 }] });
  });
});
