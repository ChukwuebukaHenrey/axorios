import { describe, expect, it } from "vitest";
import { parsePhotoShortcut, photoPrompt } from "./product-photo-shortcuts";

describe("seller product photo shortcuts", () => {
  it("recognizes a command and passes setting details", () => {
    expect(parsePhotoShortcut(" /flatlay on a wooden table ")).toEqual({
      shortcut: "/flatlay",
      details: "on a wooden table",
    });
  });
  it("rejects arbitrary chat text", () => {
    expect(parsePhotoShortcut("hello /whitebg")).toBeNull();
    expect(parsePhotoShortcut("/whitebg-extra")).toBeNull();
  });
  it("requires a named season", () => {
    expect(() => photoPrompt({ shortcut: "/seasonal", details: "" })).toThrow(/Name the season/);
  });
  it("treats product and original lettering as immutable", () => {
    const prompt = photoPrompt({ shortcut: "/billboard", details: "" });
    expect(prompt).toContain("ONLY authoritative reference");
    expect(prompt).toContain("PRINTED PHOTO");
    expect(prompt).toContain("every existing word");
  });
});
