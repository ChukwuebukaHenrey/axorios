import { cn } from "@/lib/utils";

const TONES = ["bg-sky-400/15 text-sky-200", "bg-amber-400/15 text-amber-200", "bg-violet-400/15 text-violet-200", "bg-emerald-400/15 text-emerald-200", "bg-rose-400/15 text-rose-200"];
const DOT: Record<string, string> = { telegram: "bg-sky-400", whatsapp: "bg-emerald-400", web: "bg-cream/70", instagram: "bg-pink-400" };

/** Initials on a tone picked from the name, with a small dot for the channel. */
export function Avatar({ name, channel, size = "md" }: { name: string; channel?: string; size?: "sm" | "md" }) {
  const clean = name.replace(/^[@+]/, "").trim();
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  let h = 0;
  for (const ch of clean) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={cn("relative grid shrink-0 place-items-center rounded-full font-medium", TONES[h % TONES.length], size === "sm" ? "size-7 text-[11px]" : "size-9 text-xs")} aria-hidden="true">
      {initials}
      {channel && <span className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-panel", DOT[channel] ?? "bg-stone")} />}
    </span>
  );
}
