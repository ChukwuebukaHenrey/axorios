"use client";

import { Menu, ShoppingBag, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/messages";
import { useCart } from "./cart";

export type NavLink = { href: string; label: string };

const ICON_BUTTON =
  "relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-store-ink hover:text-store-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

/** Logo in the middle, menu on the left, bag on the right. The bag opens the cart when there is one. */
export function StoreHeader({
  name,
  logo,
  homeHref,
  links,
}: {
  name: string;
  logo: string | null;
  homeHref: string;
  links: NavLink[];
}) {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const count = cart?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onClick = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  const bagLabel = t.cart.open.replace("{count}", String(count));

  return (
    // No background of its own, so the first band's wavy top edge shows under the logo.
    <header className="relative z-30 pb-6 md:pb-10">
      <div ref={panel} className="mx-auto grid h-20 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 md:h-24 md:px-8">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="store-menu"
          aria-label={open ? t.storefront.closeMenu : t.storefront.openMenu}
          onClick={() => setOpen((value) => !value)}
          className={`${ICON_BUTTON} justify-self-start`}
        >
          {open ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
        </button>

        <a href={homeHref} className="block rounded-full focus-visible:outline-2 focus-visible:outline-offset-4">
          {logo ? (
            <Image src={logo} alt={name} width={240} height={130} priority className="h-14 w-auto md:h-[4.5rem]" />
          ) : (
            <span className="font-store-heading text-2xl font-black tracking-tight md:text-3xl">{name}</span>
          )}
        </a>

        {cart && count > 0 ? (
          <button
            type="button"
            onClick={() => cart.dialog.current?.showModal()}
            aria-label={bagLabel}
            className={`${ICON_BUTTON} justify-self-end`}
          >
            <ShoppingBag className="size-6" aria-hidden="true" />
            <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-store-secondary text-xs font-bold text-store-on-secondary">
              {count}
            </span>
          </button>
        ) : (
          <a href={`${homeHref}#products`} aria-label={bagLabel} className={`${ICON_BUTTON} justify-self-end`}>
            <ShoppingBag className="size-6" aria-hidden="true" />
          </a>
        )}

        <AnimatePresence>
          {open && (
            <motion.nav
              id="store-menu"
              key="menu"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: "spring", bounce: 0.2, visualDuration: 0.25 }}
              className="absolute top-full left-4 w-[min(20rem,calc(100%-2rem))] origin-top-left rounded-3xl border-2 border-store-ink bg-store-paper p-2 shadow-xl md:left-8"
            >
              <ul className="divide-y divide-store-ink/15">
                {links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-2xl px-4 py-3 font-store-heading text-lg font-bold transition-colors hover:bg-store-ink hover:text-store-paper"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
