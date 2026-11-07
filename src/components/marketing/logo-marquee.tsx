import { ShoppingBag } from "lucide-react";
import Image from "next/image";
import { t } from "@/lib/messages";

const LOGOS = [
  { name: "PayPal", src: "/images/icons/paypal.png" },
  { name: "Telegram", src: "/images/icons/telegram.png" },
  { name: "Shopify", src: null },
  { name: "Supabase", src: "/images/icons/supabase.png" },
  { name: "WhatsApp", src: "/images/icons/whatsapp.png" },
];

function Row({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-16 pr-16 sm:gap-24 sm:pr-24">
      {LOGOS.map(({ name, src }) => (
        <li key={name} className="flex items-center gap-3 opacity-60 grayscale">
          {src ? (
            <Image src={src} alt="" width={36} height={36} className="size-9 object-contain" />
          ) : (
            // No Shopify mark in the asset set: a neutral glyph stands in for it.
            <ShoppingBag className="size-8 text-cream" aria-hidden="true" />
          )}
          <span className="font-display text-[26px] font-semibold tracking-tight text-cream">{name}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Trusted by" logo strip from the reference, filled with the tools AxoriOS actually runs on. */
export function LogoMarquee() {
  return (
    <section className="py-[120px] pt-24">
      <p className="text-center font-display text-xl text-cream/90">{t.marketing.home.trust}</p>
      <div className="mt-16 flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
        <div className="flex animate-marquee">
          <Row />
          <Row hidden />
        </div>
      </div>
    </section>
  );
}
