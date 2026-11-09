import { describe, expect, it } from "vitest";
import {
  duplicateGroups,
  labelDeleteBlockers,
  normPhone,
  systemLabel,
} from "./rules";

describe("customers rules", () => {
  it("system label is customer with a paid order, else lead", () => {
    expect(systemLabel("a", new Set(["a"]))).toBe("customer");
    expect(systemLabel("b", new Set(["a"]))).toBe("lead");
  });

  it("phones match across local and international forms", () => {
    expect(normPhone("0803 123 4567")).toBe(normPhone("+234 803 123 4567"));
    expect(normPhone("12")).toBe("");
  });

  it("suggests merges by email or phone, oldest first, skipping merged contacts", () => {
    const c = (
      id: string,
      email: string | null,
      phone: string | null,
      first: string,
      merged: string | null = null,
    ) => ({ id, email, phone, first_seen_at: first, merged_into: merged });
    const groups = duplicateGroups([
      c("new", "Ada@Mail.com", null, "2026-10-02"),
      c("old", "ada@mail.com ", "08031234567", "2026-09-01"),
      c("tel", null, "+2348031234567", "2026-10-05"),
      c("gone", "ada@mail.com", null, "2026-08-01", "old"),
      c("solo", "x@y.z", null, "2026-10-01"),
    ]);
    expect(groups.map((g) => [g.reason, g.contacts.map((x) => x.id)])).toEqual([
      ["email", ["old", "new"]],
      ["phone", ["old", "tel"]],
    ]);
  });

  it("a label used by a scheduled campaign can't be deleted; sent or draft campaigns don't block", () => {
    const campaigns = [
      { id: "1", name: "Weekend promo", status: "scheduled", segment: ["L"] },
      { id: "2", name: "Old blast", status: "sent", segment: ["L"] },
      { id: "3", name: "Other", status: "scheduled", segment: ["M"] },
    ];
    expect(labelDeleteBlockers("L", campaigns).map((c) => c.name)).toEqual([
      "Weekend promo",
    ]);
    expect(labelDeleteBlockers("Z", campaigns)).toEqual([]);
  });
});
