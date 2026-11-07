/**
 * Decorative stickers per industry template. They are template art, not store content, so they ship with the
 * app (public/images/stores) and every store on the template gets them on top of its own brand colours.
 */
export type Sticker = { src: string; w: number; h: number };

export type TemplateArt = {
  /** Big food or product slices, used beside headlines and on the order page. */
  feature: Sticker[];
  /** Small flowers, leaves and sparkles scattered along band edges. */
  small: Sticker[];
  bursts: Sticker[];
};

const bakery = (name: string, w: number, h: number): Sticker => ({ src: `/images/stores/bakery/${name}.png`, w, h });

const ART: Record<string, TemplateArt> = {
  bakery: {
    feature: [
      bakery("sticker-slice-chocolate", 712, 624),
      bakery("sticker-slice-red-velvet", 706, 619),
      bakery("sticker-slice-coconut", 707, 616),
    ],
    small: [
      bakery("sticker-flower-yellow", 405, 500),
      bakery("sticker-flower-pink", 407, 500),
      bakery("sticker-leaf-sprig", 400, 500),
      bakery("sticker-sparkle-lavender", 398, 400),
    ],
    bursts: [
      bakery("sticker-burst-1", 360, 333),
      bakery("sticker-burst-2", 360, 327),
      bakery("sticker-burst-3", 360, 335),
    ],
  },
};

/** Templates drawn with the playful band layout. Others keep the original Market sections. */
export function templateArt(preset: string): TemplateArt | null {
  return ART[preset] ?? null;
}
