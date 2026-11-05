/* eslint-disable @next/next/no-img-element -- next/og renders plain img elements, not next/image */
import "server-only";
import { ImageResponse } from "next/og";
import type { BrandKit } from "@/modules/brand";
import { allowedImage, readableOn } from "@/modules/storefront";
import type { ImageProvider, ImageRequest } from "../types";

type FontEntry = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

/**
 * Fetches a TTF from Google Fonts. The v1 CSS API returns the nearest weight, where css2 fails on a missing one.
 * Returns null on any failure, so a bad font name still gives an image.
 */
async function googleFont(family: string, weight: 400 | 700): Promise<FontEntry | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:${weight}`, {
      signal: AbortSignal.timeout(5000),
    }).then((r) => (r.ok ? r.text() : ""));
    const url = /src:\s*url\((https:[^)]+)\)\s*format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    if (!url) return null;
    const data = await fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => r.arrayBuffer());
    return { name: family, data, weight, style: "normal" };
  } catch {
    return null;
  }
}

function Footer({ kit, color, priceLabel }: { kit: BrandKit; color: string; priceLabel?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40, color, fontSize: 36 }}>
      <div style={{ display: "flex", fontFamily: kit.fonts.heading, fontWeight: 700 }}>{kit.name}</div>
      {priceLabel && <div style={{ display: "flex", fontWeight: 700 }}>{priceLabel}</div>}
    </div>
  );
}

function headlineSize(headline: string): number {
  if (headline.length <= 18) return 128;
  if (headline.length <= 34) return 104;
  return 84;
}

/** Three layouts over one palette and type pair: a campaign varies but reads as one brand. */
function layout({ brand: kit, headline, subline, priceLabel, productImageUrl, variant }: ImageRequest) {
  const { primary, secondary, accent, neutralLight } = kit.palette;
  const photo = allowedImage(productImageUrl ?? null);
  const heading = { fontFamily: kit.fonts.heading, fontWeight: 700, lineHeight: 1.05 } as const;
  const body = { fontFamily: kit.fonts.body, fontWeight: 400, lineHeight: 1.25 } as const;
  const page = { width: "100%", height: "100%", display: "flex", fontFamily: kit.fonts.body } as const;

  if (variant % 3 === 1) {
    const onSecondary = readableOn(secondary);
    return (
      <div style={{ ...page, flexDirection: "column", background: neutralLight }}>
        <div style={{ display: "flex", height: 520, alignItems: "center", justifyContent: "center", background: secondary, color: onSecondary }}>
          {photo ? (
            <img src={photo} alt="" width={1080} height={520} style={{ objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", ...heading, fontSize: 300 }}>{Array.from(kit.name)[0]?.toUpperCase()}</div>
          )}
        </div>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", padding: 64, color: readableOn(neutralLight) }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", ...heading, fontSize: Math.min(headlineSize(headline), 92) }}>{headline}</div>
            <div style={{ display: "flex", ...body, fontSize: 36 }}>{subline}</div>
          </div>
          <Footer kit={kit} color={readableOn(neutralLight)} priceLabel={priceLabel} />
        </div>
      </div>
    );
  }

  if (variant % 3 === 2) {
    return (
      <div style={{ ...page, padding: 56, background: accent }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", padding: 64, borderRadius: 48, background: neutralLight, color: readableOn(neutralLight) }}>
          <div style={{ display: "flex", width: 140, height: 16, borderRadius: 8, background: primary }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ display: "flex", ...heading, fontSize: headlineSize(headline) }}>{headline}</div>
            <div style={{ display: "flex", ...body, fontSize: 40 }}>{subline}</div>
          </div>
          <Footer kit={kit} color={readableOn(neutralLight)} priceLabel={priceLabel} />
        </div>
      </div>
    );
  }

  const onPrimary = readableOn(primary);
  return (
    <div style={{ ...page, flexDirection: "column", justifyContent: "space-between", padding: 80, background: primary, color: onPrimary }}>
      <div style={{ display: "flex", width: 140, height: 16, borderRadius: 8, background: secondary }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <div style={{ display: "flex", ...heading, fontSize: headlineSize(headline) }}>{headline}</div>
        <div style={{ display: "flex", ...body, fontSize: 44 }}>{subline}</div>
      </div>
      <Footer kit={kit} color={onPrimary} priceLabel={priceLabel} />
    </div>
  );
}

/** Renders on-brand graphics with no AI model, so marketing works with no image billing. */
export const templateImages: ImageProvider = {
  name: "template",

  async generate(request) {
    const { fonts } = request.brand;
    const loaded = await Promise.all([googleFont(fonts.heading, 700), googleFont(fonts.body, 400)]);
    const image = new ImageResponse(layout(request), {
      ...request.size,
      fonts: loaded.filter((font): font is FontEntry => font !== null),
    });
    const bytes = new Uint8Array(await image.arrayBuffer());
    if (bytes.length === 0) throw new Error("Image render returned nothing");
    return { bytes, contentType: "image/png" };
  },
};
