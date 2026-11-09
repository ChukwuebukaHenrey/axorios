import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { packEntries } from "./pack";
import { buildZip } from "./zip";

describe("packEntries", () => {
  it("gives each post its image, caption and suggested time", () => {
    const entries = packEntries([
      { caption: "First", suggestedAt: "2026-11-06T09:00:00Z", image: new Uint8Array([1]) },
      { caption: "Second", suggestedAt: null, image: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) },
    ]);
    expect(entries.map((e) => e.path)).toEqual([
      "post-1/image.png",
      "post-1/caption.txt",
      "post-1/suggested-time.txt",
      "post-2/image.jpg",
      "post-2/caption.txt",
      "post-2/suggested-time.txt",
    ]);
    expect(new TextDecoder().decode(entries[2].data)).toContain("06 Nov 2026 09:00:00");
    expect(new TextDecoder().decode(entries[5].data)).toBe("Any time");
  });
});

/** Follows the zip's own directory, as an unzip tool does. A real tool opens the real download in scripts/e2e-publish.mts. */
function readZip(zip: Buffer) {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files: { path: string; data: Buffer; crc: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(at)).toBe(0x02014b50);
    const size = zip.readUInt32LE(at + 24);
    const nameLength = zip.readUInt16LE(at + 28);
    const local = zip.readUInt32LE(at + 42);
    expect(zip.readUInt32LE(local)).toBe(0x04034b50);
    const start = local + 30 + zip.readUInt16LE(local + 26);
    files.push({
      path: zip.toString("utf8", at + 46, at + 46 + nameLength),
      data: zip.subarray(start, start + size),
      crc: zip.readUInt32LE(at + 16),
    });
    at += 46 + nameLength;
  }
  return files;
}

describe("buildZip", () => {
  it("stores every file with its bytes, checksum and non-English text intact", () => {
    const image = new Uint8Array([0, 255, 137, 80, 78, 71]);
    const caption = new TextEncoder().encode("Cake: ₦45,000");
    const files = readZip(
      buildZip([
        { path: "post-1/image.png", data: image },
        { path: "post-1/caption.txt", data: caption },
      ]),
    );
    expect(files.map((f) => f.path)).toEqual(["post-1/image.png", "post-1/caption.txt"]);
    expect([...files[0].data]).toEqual([...image]);
    expect(files[1].data.toString("utf8")).toBe("Cake: ₦45,000");
    expect(files[0].crc).toBe(crc32(image));
  });
});

describe("demo publishers", () => {
  it("publish returns a permalink on the store's own domain, never a platform URL", async () => {
    const { DEMO_PUBLISHERS, demoPublisher } = await import("./adapters/demo");
    for (const name of DEMO_PUBLISHERS) {
      const { url } = await demoPublisher(name, () => "https://axorios.example").publish({ caption: "Hi", postId: "11111111-2222-3333-4444-555555555555", storeSlug: "demo" });
      expect(url).toBe("https://axorios.example/s/demo/p/11111111-2222-3333-4444-555555555555");
      expect(url).not.toMatch(/facebook|instagram|tiktok|google/);
    }
    expect(DEMO_PUBLISHERS).toEqual(["facebook", "instagram", "tiktok", "google"]);
  });
});
