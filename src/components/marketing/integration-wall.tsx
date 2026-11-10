import { ShoppingBag } from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";
import { t } from "@/lib/messages";
import { CONTAINER, SECTION, SectionHeading } from "./ui";

const g = t.marketing.home.integration;

type Tile = { name: string; src: string | null; glow: string };

/** Lane 1: what AxoriOS runs on today. Lanes 2 and 3: the same adapter slots filled with other tools. */
const ROWS: Tile[][] = [
  [
    { name: "Telegram", src: "/images/icons/telegram.png", glow: "#2aa5e0" },
    { name: "PayPal", src: "/images/icons/paypal.png", glow: "#2f6fe0" },
    { name: "Shopify", src: null, glow: "#5fbf3f" },
    { name: "Supabase", src: "/images/icons/supabase.png", glow: "#3ecf8e" },
    { name: "WhatsApp", src: "/images/icons/whatsapp.png", glow: "#25d366" },
  ],
  [
    { name: "Messenger", src: "/images/icons/messenger.png", glow: "#a64dff" },
    { name: "Discord", src: "/images/icons/discord.png", glow: "#5865f2" },
    { name: "Viber", src: "/images/icons/viber.png", glow: "#7360f2" },
    { name: "Slack", src: "/images/icons/slack.png", glow: "#e01e5a" },
    { name: "Teams", src: "/images/icons/teams.png", glow: "#5b5fc7" },
  ],
  [
    { name: "Zoom", src: "/images/icons/zoom.png", glow: "#2d8cff" },
    { name: "Notion", src: "/images/icons/notion.png", glow: "#9b9b9b" },
    { name: "Trello", src: "/images/icons/trello.png", glow: "#0079bf" },
    { name: "Google Drive", src: "/images/icons/google_drive.png", glow: "#fbbc04" },
    { name: "VS Code", src: "/images/icons/vscode.png", glow: "#23a9f2" },
  ],
];

function IconTile({ tile, faded }: { tile: Tile; faded: boolean }) {
  return (
    <li
      title={tile.name}
      style={{ boxShadow: `inset 0 0 0 1px ${tile.glow}66, 0 8px 30px -12px ${tile.glow}` }}
      className={`grid size-16 place-items-center rounded-2xl bg-gradient-to-b from-[#2a2a2a] to-[#141414] sm:size-[88px] shrink-0 ${faded ? "opacity-60" : ""}`}
    >
      {tile.src ? (
        <Image src={tile.src} alt={tile.name} width={56} height={56} className="size-10 object-contain sm:size-14" />
      ) : (
        // No Shopify mark in the asset set: a neutral glyph marks the slot.
        <ShoppingBag className="size-8 text-[#95bf47] sm:size-10" aria-label={tile.name} />
      )}
    </li>
  );
}

/**
 * One moving lane of tiles. The set is repeated so a single copy is wider than any screen, then doubled so the
 * -50% keyframe loops without a seam. Lanes alternate direction; hover pauses; reduced motion holds them still.
 */
function Lane({ tiles, direction, duration, faded }: { tiles: Tile[]; direction: "left" | "right"; duration: number; faded: boolean }) {
  const set = Array.from({ length: Math.ceil(12 / tiles.length) }, () => tiles).flat();
  return (
    <div className="marquee-lane flex overflow-hidden py-3 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="marquee-row flex shrink-0" data-direction={direction} style={{ "--marquee-duration": `${duration}s` } as CSSProperties}>
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 gap-3 pr-3 sm:gap-5 sm:pr-5">
            {set.map((tile, i) => (
              <IconTile key={`${tile.name}-${i}`} tile={tile} faded={faded} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function IntegrationWall({ heading = true }: { heading?: boolean }) {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        {heading && <SectionHeading eyebrow={g.eyebrow} title={g.title} subhead={g.subhead} />}
      </div>
      {/* Full width so the lanes run edge to edge: the first row is what AxoriOS runs on today. */}
      <div className="mt-16 flex flex-col gap-1 sm:mt-24">
        {ROWS.map((row, r) => (
          <Lane key={r} tiles={row} direction={r % 2 ? "right" : "left"} duration={44 + r * 8} faded={r > 0} />
        ))}
      </div>
      <div className={CONTAINER}>
        <p className="mx-auto mt-10 max-w-[570px] text-center font-mono text-xs leading-relaxed text-stone">{g.live}</p>
        <p className="mx-auto mt-16 max-w-[570px] text-center text-base leading-relaxed text-cream sm:mt-20">{g.footnote}</p>
      </div>
    </section>
  );
}
