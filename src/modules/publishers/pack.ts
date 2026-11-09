import type { ZipEntry } from "./zip";

export type PackPost = { caption: string; suggestedAt: string | null; image: Uint8Array };

/** Named by the bytes, not the URL: template posts are PNG, photo posts are JPEG. */
export function imageExtension(image: Uint8Array): "jpg" | "png" {
  return image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff ? "jpg" : "png";
}

/** Each post as a folder: the image, the caption, and when to post it, for sellers posting by hand. */
export function packEntries(posts: PackPost[]): ZipEntry[] {
  const text = (value: string) => new TextEncoder().encode(value);
  return posts.flatMap(({ caption, suggestedAt, image }, i) => {
    const folder = `post-${i + 1}`;
    const when = suggestedAt ? new Date(suggestedAt).toUTCString() : "Any time";
    return [
      { path: `${folder}/image.${imageExtension(image)}`, data: image },
      { path: `${folder}/caption.txt`, data: text(caption) },
      { path: `${folder}/suggested-time.txt`, data: text(when) },
    ];
  });
}
