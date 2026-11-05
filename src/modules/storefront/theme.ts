import type { CSSProperties } from "react";
import type { DesignTokens } from "./schema";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Near-black or white, whichever reads better on this background. */
export function readableOn(background: string): string {
  return contrastRatio("#111111", background) >= contrastRatio("#ffffff", background) ? "#111111" : "#ffffff";
}

/** Keeps the brand's colour unless a model-picked pair is unreadable (WCAG AA). */
function ensureReadable(text: string, background: string): string {
  return contrastRatio(text, background) >= 4.5 ? text : readableOn(background);
}

const RADIUS = { none: "0", soft: "0.5rem", round: "1.25rem" } as const;
const SECTION_SPACE = { compact: "3rem", comfortable: "4.5rem", airy: "7rem" } as const;
const IMAGE_ASPECT = { square: "1 / 1", portrait: "4 / 5", wide: "4 / 3" } as const;

function fontStack(name: string): string {
  const safe = name.replace(/[^\p{L}\p{N} -]/gu, "");
  return `"${safe}", system-ui, sans-serif`;
}

/** The brand as CSS variables on the store root, so one set of components looks different per store. */
export function storeCssVars(tokens: DesignTokens): CSSProperties {
  const { palette, fonts } = tokens;
  return {
    "--store-primary": palette.primary,
    "--store-on-primary": readableOn(palette.primary),
    "--store-secondary": palette.secondary,
    "--store-on-secondary": readableOn(palette.secondary),
    "--store-accent": palette.accent,
    "--store-on-accent": readableOn(palette.accent),
    "--store-paper": palette.neutralLight,
    "--store-ink": ensureReadable(palette.neutralDark, palette.neutralLight),
    "--store-font-heading": fontStack(fonts.heading),
    "--store-font-body": fontStack(fonts.body),
    "--store-radius": RADIUS[tokens.radius],
    "--store-section": SECTION_SPACE[tokens.spacing],
    "--store-image-aspect": IMAGE_ASPECT[tokens.imageStyle],
  } as CSSProperties;
}

/**
 * Brand fonts are any Google Font name, which next/font can't load because it needs them at build time.
 * Uses the v1 CSS API because it returns whichever weights exist, where css2 fails on a missing one.
 * One link per family, so a font name Google doesn't know can't take the other font down with it.
 */
export function googleFontHrefs(fonts: DesignTokens["fonts"]): string[] {
  const families = [...new Set([fonts.heading, fonts.body])];
  return families.map(
    (family) => `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:400,600,700&display=swap`,
  );
}

/** next/image throws on a host it isn't configured for, which would take the whole store down. */
export function allowedImage(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol, hostname, pathname } = new URL(url);
    const ok =
      protocol === "https:" && hostname.endsWith(".supabase.co") && pathname.startsWith("/storage/v1/object/public/");
    return ok ? url : null;
  } catch {
    return null;
  }
}

/** storeLanguage comes from the model, and an invalid tag would throw in Intl on a public page. */
export function safeLocale(tag: string): string {
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? "en";
  } catch {
    return "en";
  }
}
