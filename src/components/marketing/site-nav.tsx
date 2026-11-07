"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";

const n = t.marketing.nav;

export const NAV_LINKS = [
  { href: "/", label: n.home },
  { href: "/features", label: n.features },
  { href: "/use-case", label: n.useCase },
  { href: "/integrations", label: n.integrations },
  { href: "/pricing", label: n.pricing },
];

/** Home is the logo, so the tab only lists the other pages. */
const TAB_LINKS = NAV_LINKS.filter(({ href }) => href !== "/");

const THEMES = {
  light: { tab: "bg-white text-black", corner: "#ffffff", divider: "divide-black/[0.07]", muted: "text-black/65 hover:text-black" },
  dark: { tab: "bg-panel-2 text-cream", corner: "#1f1f1f", divider: "divide-cream/10", muted: "text-cream/65 hover:text-cream" },
} as const;

/**
 * The tab's concave top corners: a square filled with the tab colour except for a quarter circle,
 * so the tab looks cut out of the page's top edge (the Solidroad nav reference).
 */
function Corner({ side, color }: { side: "left" | "right"; color: string }) {
  const at = side === "left" ? "0 100%" : "100% 100%";
  return (
    <span
      aria-hidden="true"
      className={`absolute top-0 size-5 ${side === "left" ? "-left-5" : "-right-5"}`}
      style={{ background: `radial-gradient(circle at ${at}, transparent 19.5px, ${color} 20px)` }}
    />
  );
}

function CtaButton({ className = "", onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link
      href="/sign-up"
      onClick={onClick}
      className={`group inline-flex h-11 items-center gap-3 rounded-xl bg-lime pr-1.5 pl-4 font-mono text-[15px] font-semibold tracking-tight text-black transition hover:bg-lime/85 ${className}`}
    >
      {n.getStarted}
      <span className="grid size-8 place-items-center rounded-lg bg-black/10 transition group-hover:translate-x-0.5">
        <ArrowRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

/** `light` sits on the photo heroes (white tab), `dark` sits on the black pages (charcoal tab). */
export function SiteNav({ theme = "dark" }: { theme?: "light" | "dark" }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const c = THEMES[theme];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const brand = (
    <Link href="/" aria-label={t.marketing.brand} className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
      <Logo className="size-7" />
      <span className="font-display text-xl font-semibold tracking-tight">{t.marketing.brand}</span>
    </Link>
  );

  return (
    <header className="relative z-30 px-3 sm:px-6">
      {/* Desktop: links left, logo centred, sign in + CTA right. */}
      <nav
        aria-label={n.label}
        className={`relative mx-auto hidden h-[68px] max-w-[1080px] grid-cols-[1fr_auto_1fr] items-center rounded-b-[22px] px-6 lg:grid ${c.tab}`}
      >
        <Corner side="left" color={c.corner} />
        <Corner side="right" color={c.corner} />
        <ul className="flex items-center gap-7">
          {TAB_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`font-display text-[15px] transition ${active ? "font-medium" : c.muted}`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        {brand}
        <div className="flex items-center justify-end gap-5">
          <Link href="/sign-in" className={`font-display text-[15px] transition ${c.muted}`}>
            {n.signIn}
          </Link>
          <CtaButton />
        </div>
      </nav>

      {/* Mobile and tablet: a tab with logo + menu that grows into a card. */}
      <div className="relative h-14 lg:hidden">
      <motion.nav
        aria-label={n.label}
        layout={!reduce}
        transition={{ type: "spring", bounce: 0, duration: 0.35 }}
        style={{
          borderTopLeftRadius: open ? 22 : 0,
          borderTopRightRadius: open ? 22 : 0,
          borderBottomLeftRadius: open ? 22 : 20,
          borderBottomRightRadius: open ? 22 : 20,
        }}
        className={`absolute inset-x-0 mx-auto max-w-[560px] ${c.tab} ${open ? "top-3 shadow-2xl shadow-black/40" : "top-0"}`}
      >
        {!open && (
          <>
            <Corner side="left" color={c.corner} />
            <Corner side="right" color={c.corner} />
          </>
        )}
        <motion.div layout={!reduce ? "position" : false} className="flex h-14 items-center justify-between pr-2 pl-4">
          {brand}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? n.close : n.menu}
            className="grid size-11 place-items-center rounded-lg"
          >
            {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
          </button>
        </motion.div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="mobile-nav"
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, delay: reduce ? 0 : 0.08 }}
              className="px-4 pb-4"
            >
              <ul className={`divide-y ${c.divider}`}>
                {TAB_LINKS.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={pathname === href ? "page" : undefined}
                      className="flex min-h-12 items-center font-display text-base aria-[current=page]:font-semibold"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex items-center justify-between gap-4">
                <Link href="/sign-in" onClick={() => setOpen(false)} className="flex min-h-11 items-center font-display text-base">
                  {n.signIn}
                </Link>
                <CtaButton onClick={() => setOpen(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
      </div>
    </header>
  );
}
