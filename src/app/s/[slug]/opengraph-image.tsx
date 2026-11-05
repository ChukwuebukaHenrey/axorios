/* eslint-disable @next/next/no-img-element -- next/og renders plain img elements, not next/image */
import { ImageResponse } from "next/og";
import { allowedImage, getLiveStorefront, readableOn } from "@/modules/storefront";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Store preview";

/** What a pasted link shows in WhatsApp and elsewhere: the store's name and logo in its own colours. */
export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getLiveStorefront(slug);
  if (!store) return new Response("Not found", { status: 404 });

  const { name, tagline, logoUrl, palette } = store.kit;
  const logo = allowedImage(logoUrl);
  const onPrimary = readableOn(palette.primary);
  const onSecondary = readableOn(palette.secondary);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: 80,
        background: palette.primary,
        color: onPrimary,
      }}
    >
      {logo ? (
        <img src={logo} alt="" width={220} height={220} style={{ borderRadius: 40, objectFit: "cover" }} />
      ) : (
        <div
          style={{
            width: 220,
            height: 220,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 40,
            background: palette.secondary,
            color: onSecondary,
            fontSize: 130,
            fontWeight: 700,
          }}
        >
          {Array.from(name)[0]?.toUpperCase()}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{name}</div>
        <div style={{ fontSize: 36, lineHeight: 1.25, opacity: 0.9 }}>{tagline}</div>
      </div>
    </div>,
    size,
  );
}
