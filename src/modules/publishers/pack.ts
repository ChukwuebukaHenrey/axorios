import type { ZipEntry } from "./zip";

export type PackPost = { caption: string; suggestedAt: string | null; image: Uint8Array };

/** Each post as a folder: the image, the caption, and when to post it, for sellers posting by hand. */
export function packEntries(posts: PackPost[]): ZipEntry[] {
  const text = (value: string) => new TextEncoder().encode(value);
  return posts.flatMap(({ caption, suggestedAt, image }, i) => {
    const folder = `post-${i + 1}`;
    const when = suggestedAt ? new Date(suggestedAt).toUTCString() : "Any time";
    return [
      { path: `${folder}/image.png`, data: image },
      { path: `${folder}/caption.txt`, data: text(caption) },
      { path: `${folder}/suggested-time.txt`, data: text(when) },
    ];
  });
}
