import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const CONTAINER = "mx-auto w-full max-w-[1160px] px-5 sm:px-8 xl:px-0";
export const SECTION = "py-20 sm:py-28 lg:py-[120px]";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-lime/35 bg-[#13150c] px-2.5 py-1 font-mono text-[11px] leading-none tracking-wide text-cream uppercase">
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subhead,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  subhead?: string;
  className?: string;
}) {
  return (
    <div className={`mx-auto flex max-w-[766px] flex-col items-center text-center ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-5 font-display text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-cream">
        {title}
      </h2>
      {subhead && (
        <p className="mt-5 max-w-[648px] text-base leading-relaxed text-cream/80 text-balance sm:text-lg">{subhead}</p>
      )}
    </div>
  );
}

const BUTTON_VARIANTS = {
  black: "bg-black text-cream hover:bg-black/85",
  cream: "bg-cream text-black hover:bg-cream/85",
  lime: "bg-lime text-black hover:bg-lime/85",
  muted: "bg-panel-3 text-cream hover:bg-[#333]",
} as const;

type ButtonProps = {
  href: string;
  variant?: keyof typeof BUTTON_VARIANTS;
  children: ReactNode;
  className?: string;
  external?: boolean;
};

/** The reference's button: rounded rectangle, monospace label. */
export function Button({ href, variant = "black", children, className = "", external = false }: ButtonProps) {
  const classes = `inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 font-mono text-[15px] font-semibold tracking-tight transition ${BUTTON_VARIANTS[variant]} ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/** Outer frame with an 8 px inset inner panel: the reference's card-in-card pattern. */
export function Panel({ children, className = "", ...rest }: ComponentProps<"div">) {
  return (
    <div className={`rounded-3xl bg-panel-2 p-2 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function InnerPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-[#262626] ${className}`}>{children}</div>;
}

/** Four-point sparkle, used as the faint backdrop on stat cards and as the brand glyph. */
export function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path d="M50 0C52 34 66 48 100 50C66 52 52 66 50 100C48 66 34 52 0 50C34 48 48 34 50 0Z" fill="currentColor" />
    </svg>
  );
}

/** Stands in for a Figma asset AxoriOS doesn't have yet, so the gap is visible rather than faked. */
export function AssetPlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex items-center justify-center rounded-2xl border border-dashed border-cream/25 bg-panel/80 p-6 text-center font-mono text-xs text-stone ${className}`}
    >
      {label}
    </div>
  );
}
