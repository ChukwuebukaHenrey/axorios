import { describe, expect, it } from "vitest";
import { buildPhotoPrompt, parsePhotoShortcut } from "./photo-shortcuts";

describe("product photography shortcuts", () => {
  it("only matches commands at the start of a message", () => {
    expect(parsePhotoShortcut(" /whitebg use softer light ")).toEqual({ code: "/whitebg", details: "use softer light" });
    expect(parsePhotoShortcut("please /whitebg")).toBeNull();
    expect(parsePhotoShortcut("/whitebackground")).toBeNull();
  });
  it("preserves the additional seasonal instructions", () => {
    const season = parsePhotoShortcut("/seasonal winter with snow");
    expect(season).not.toBeNull();
    expect(buildPhotoPrompt(season!)).toContain("winter with snow");
    expect(() => buildPhotoPrompt(parsePhotoShortcut("/seasonal")!)).toThrow("Which season?");
  });
  it("always requires the attached original rather than a generated result", () => {
    expect(buildPhotoPrompt(parsePhotoShortcut("/inuse")!)).toContain("ATTACHED ORIGINAL PRODUCT PHOTO");
    expect(buildPhotoPrompt(parsePhotoShortcut("/billboard")!)).toContain("Print a large photograph");
  });
});