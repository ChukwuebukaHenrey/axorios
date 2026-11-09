import type { Publisher } from "../types";

/**
 * Demo publishers for Meta (Facebook, Instagram), TikTok and Google Business Profile, until developer
 * accounts exist (spec v2, "Demo adapters"). Same interface as a real one: publishing posts nothing outside
 * AxoriOS and returns a permalink on the store's own domain, never a platform URL. The publish job marks
 * the post published. Replacing one with a real adapter is one file plus its flag.
 */
export const DEMO_PUBLISHERS = ["facebook", "instagram", "tiktok", "google"] as const;
export type DemoPublisherName = (typeof DEMO_PUBLISHERS)[number];

/** Which env flag switches each demo publisher on. */
export const DEMO_FLAG: Record<DemoPublisherName, "META_PROVIDER" | "TIKTOK_PROVIDER" | "GOOGLE_PROVIDER"> = {
  facebook: "META_PROVIDER",
  instagram: "META_PROVIDER",
  tiktok: "TIKTOK_PROVIDER",
  google: "GOOGLE_PROVIDER",
};

export function demoPermalink(appUrl: string, storeSlug: string, postId: string): string {
  return new URL(`/s/${encodeURIComponent(storeSlug)}/p/${encodeURIComponent(postId)}`, appUrl).toString();
}

export function demoPublisher(name: DemoPublisherName, appUrl: () => string): Publisher {
  return {
    name,
    capabilities: () => ({ images: name !== "google", schedule: true }),
    async publish({ postId, storeSlug }) {
      return { url: demoPermalink(appUrl(), storeSlug, postId) };
    },
  };
}
