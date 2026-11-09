import type { BrandKit } from "@/modules/brand";

export type ImageRequest = {
  /** Full text prompt with the brand kit in it, for providers that generate from a prompt. */
  prompt: string;
  referenceImages: string[];
  size: { width: number; height: number };
  /** What a template-based provider lays out. */
  brand: BrandKit;
  headline: string;
  subline: string;
  /** Written by code from the database, never by the model. */
  priceLabel?: string;
  productImageUrl?: string | null;
  /** Which of the provider's layouts to use, so a campaign varies while staying on brand. */
  variant: number;
};

/** PNG for flat template graphics, JPEG for photo backgrounds. Storage paths take their extension from this. */
export type GeneratedImage = { bytes: Uint8Array; contentType: "image/png" | "image/jpeg" };

export interface ImageProvider {
  name: string;
  generate(request: ImageRequest): Promise<GeneratedImage>;
}
