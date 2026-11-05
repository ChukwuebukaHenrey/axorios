import Image from "next/image";
import { allowedImage } from "../theme";

const TONES = [
  "bg-store-primary text-store-on-primary",
  "bg-store-secondary text-store-on-secondary",
  "bg-store-accent text-store-on-accent",
];

/** A product's photo or, until it has one, an on-brand tile with its initial. */
export function ProductArt({
  name,
  imageUrl,
  index,
  sizes,
  className = "",
}: {
  name: string;
  imageUrl: string | null;
  index: number;
  sizes: string;
  className?: string;
}) {
  const src = allowedImage(imageUrl);
  return (
    <div
      className={`@container relative aspect-[var(--store-image-aspect)] overflow-hidden rounded-store ${src ? "" : TONES[index % TONES.length]} ${className}`}
    >
      {src ? (
        <Image src={src} alt={name} fill sizes={sizes} className="object-cover" />
      ) : (
        <>
          <span
            aria-hidden="true"
            className="absolute -right-[12%] -bottom-[18%] aspect-square w-[65%] rounded-full bg-current opacity-10"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center font-store-heading text-[40cqw] leading-none font-bold"
          >
            {Array.from(name)[0]?.toUpperCase()}
          </span>
        </>
      )}
    </div>
  );
}

/** The hero picture or, until the store has one, a composition from the brand's colours. */
export function HeroArt({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const src = allowedImage(imageUrl);
  return (
    <div className="@container relative aspect-square overflow-hidden rounded-store bg-store-primary text-store-on-primary">
      {src ? (
        <Image src={src} alt={name} fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
      ) : (
        <>
          <span aria-hidden="true" className="absolute -top-[12%] -left-[12%] aspect-square w-[62%] rounded-full bg-store-secondary" />
          <span aria-hidden="true" className="absolute -right-[10%] -bottom-[14%] aspect-square w-[72%] rounded-full bg-store-accent" />
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 grid aspect-square w-[52%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-store-primary font-store-heading text-[28cqw] leading-none font-bold"
          >
            {Array.from(name)[0]?.toUpperCase()}
          </span>
        </>
      )}
    </div>
  );
}
