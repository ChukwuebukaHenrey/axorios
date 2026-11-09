import { describe, expect, it } from "vitest";
import { csvToRecords, parseCsv, toCsv } from "./csv";
import { OrderImportRow, ProductImportRow, validateRows } from "./schema";

describe("csv", () => {
  it("round-trips quotes, commas and newlines", () => {
    const rows = [{ a: 'say "hi", ok', b: "line\nbreak", c: 3 }];
    expect(parseCsv(toCsv(rows, ["a", "b", "c"]))).toEqual([["a", "b", "c"], ['say "hi", ok', "line\nbreak", "3"]]);
  });
  it("blank cells become missing, not empty strings", () => {
    expect(csvToRecords("name,price_minor\nCake,\n")).toEqual([{ name: "Cake", price_minor: undefined }]);
  });
});

describe("import validation", () => {
  it("a missing price is flagged, never filled in", () => {
    const { valid, problems } = validateRows(ProductImportRow, csvToRecords("name,price_minor,currency\nCake,,NGN\nPie,500000,NGN\n"));
    expect(valid).toHaveLength(1);
    expect(problems[0]).toMatchObject({ row: 1 });
    expect(problems[0].issues.join()).toContain("price_minor");
  });
  it("values pass through unchanged", () => {
    const { valid } = validateRows(ProductImportRow, [{ name: "Cake", price_minor: "4500000", currency: "NGN" }]);
    expect(valid[0].price_minor).toBe(4_500_000);
  });
  it("order rows need a real product id and a paid time", () => {
    const { problems } = validateRows(OrderImportRow, [{ order_ref: "1", product_id: "nope", channel: "web" }]);
    expect(problems[0].issues.join()).toMatch(/product_id/);
    expect(problems[0].issues.join()).toMatch(/paid_at/);
  });
});
