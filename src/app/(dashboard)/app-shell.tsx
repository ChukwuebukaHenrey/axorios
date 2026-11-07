"use client";

import { Bell, ChevronDown, ExternalLink, Eye, Inbox, LogOut, Megaphone, Menu, Package, Plug, Search, Sparkles, Store, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";
import { signOut } from "./shell-actions";

const n = t.app.nav;

type Props = {
  store: { name: string | null; slug: string; live: boolean; draftUrl: string | null };
  account: { email: string; name: string | null };
  counts: { orders: number; inbox: number; campaigns: number };
  children: ReactNode;
};

function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function Sidebar({ store, counts, onNavigate }: Pick<Props, "store" | "counts"> & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  const items = [
    { href: "/build", label: n.build, icon: Sparkles, count: 0 },
    { href: "/dashboard", label: n.orders, icon: Package, count: counts.orders },
    { href: "/dashboard/inbox", label: n.inbox, icon: Inbox, count: counts.inbox },
    { href: "/dashboard/campaigns", label: n.campaigns, icon: Megaphone, count: counts.campaigns },
    { href: "/dashboard/integrations", label: n.integrations, icon: Plug, count: 0 },
  ];
  const active = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  return (
    <div className="flex h-full flex-col px-5 py-7">
      <Link href="/" className="flex items-center gap-3 px-1 text-cream" onClick={onNavigate}>
        <Logo className="size-10" />
        <span className="text-[26px] font-medium tracking-tight">{t.marketing.brand}</span>
      </Link>

      <p className="mt-10 px-1 text-xs font-medium tracking-wider text-stone uppercase">{n.workspace}</p>
      <div ref={ref} className="relative mt-2.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex h-12 w-full items-center gap-3 rounded-xl border border-panel-3 bg-panel-2 px-3 text-left text-cream transition hover:border-cream/25"
        >
          <Store className="size-5 shrink-0 text-stone" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-base">{store.name ?? n.unnamed}</span>
          <ChevronDown className={`size-4 shrink-0 text-stone transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {open && (
          <div className="absolute inset-x-0 top-14 z-30 rounded-xl border border-panel-3 bg-panel-2 p-1.5 shadow-2xl">
            <p className="flex items-center justify-between px-3 py-2 text-xs text-stone">
              /s/{store.slug}
              <span className={`rounded-full px-2 py-0.5 ${store.live ? "bg-lime/15 text-lime" : "bg-panel-3 text-stone"}`}>
                {store.live ? n.live : n.draft}
              </span>
            </p>
            {store.live && (
              <a href={`/s/${store.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-cream hover:bg-panel-3">
                <ExternalLink className="size-4" aria-hidden="true" /> {n.viewLive}
              </a>
            )}
            {store.draftUrl && (
              <a href={store.draftUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-cream hover:bg-panel-3">
                <Eye className="size-4" aria-hidden="true" /> {n.viewDraft}
              </a>
            )}
          </div>
        )}
      </div>

      <p className="mt-9 px-1 text-xs font-medium tracking-wider text-stone uppercase">{n.operations}</p>
      <nav className="mt-2.5 flex flex-col gap-1">
        {items.map(({ href, label, icon: Icon, count }) => {
          const on = active(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={on ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-xl px-3 text-base transition ${
                on ? "border border-lime/25 bg-[#2b3118] text-cream" : "border border-transparent text-cream/75 hover:bg-panel-2 hover:text-cream"
              }`}
            >
              <Icon className={`size-5 shrink-0 ${on ? "text-lime" : ""}`} aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {count > 0 && <span className="min-w-7 rounded-full bg-panel-3 px-2 py-0.5 text-center text-xs text-cream">{count}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/dashboard?q=${encodeURIComponent(query)}` : "/dashboard");
  }

  return (
    <form onSubmit={submit} role="search" className="relative hidden w-full max-w-[430px] sm:block">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-stone" aria-hidden="true" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={n.search}
        aria-label={n.searchLabel}
        className="h-12 w-full rounded-xl border border-panel-3 bg-panel-2 pr-4 pl-12 text-base text-cream placeholder:text-stone outline-none focus:border-cream/40"
      />
    </form>
  );
}

function TopBar({ account, counts, onMenu }: Pick<Props, "account" | "counts"> & { onMenu: () => void }) {
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const bellRef = useClickOutside(bell, () => setBell(false));
  const menuRef = useClickOutside(menu, () => setMenu(false));
  const initials = (account.name ?? account.email).slice(0, 2).toUpperCase();

  return (
    <header className="flex h-20 shrink-0 items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button type="button" onClick={onMenu} aria-label={n.menu} className="grid size-11 place-items-center rounded-xl bg-panel-2 text-cream lg:hidden">
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <div className="ml-auto flex items-center gap-3">
        <Suspense>
          <SearchBox />
        </Suspense>

        <div ref={bellRef} className="relative">
          <button
            type="button"
            onClick={() => setBell(!bell)}
            aria-label={n.notifications}
            aria-expanded={bell}
            className="relative grid size-12 place-items-center rounded-xl border border-panel-3 bg-panel-2 text-cream transition hover:border-cream/25"
          >
            <Bell className="size-5" aria-hidden="true" />
            {counts.inbox > 0 && <span className="absolute top-3 right-3 size-2 rounded-full bg-lime" />}
          </button>
          {bell && (
            <div className="absolute top-14 right-0 z-30 w-72 rounded-xl border border-panel-3 bg-panel-2 p-4 text-sm shadow-2xl">
              <p className="text-cream">{counts.inbox > 0 ? n.waiting.replace("{count}", String(counts.inbox)) : n.caughtUp}</p>
              {counts.inbox > 0 && (
                <Link href="/dashboard/inbox" onClick={() => setBell(false)} className="mt-3 inline-block text-lime underline underline-offset-4">
                  {n.openInbox}
                </Link>
              )}
            </div>
          )}
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenu(!menu)}
            aria-label={n.account}
            aria-expanded={menu}
            className="flex items-center gap-1.5 rounded-xl text-cream"
          >
            <span className="grid size-12 place-items-center rounded-full bg-panel-3 text-base font-medium">{initials}</span>
            <ChevronDown className="size-4 text-stone" aria-hidden="true" />
          </button>
          {menu && (
            <div className="absolute top-14 right-0 z-30 w-64 rounded-xl border border-panel-3 bg-panel-2 p-1.5 shadow-2xl">
              <p className="truncate px-3 py-2 text-sm text-stone">{account.email}</p>
              <form action={signOut}>
                <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-cream hover:bg-panel-3">
                  <LogOut className="size-4" aria-hidden="true" /> {n.signOut}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** The seller app frame from the dashboard reference: sidebar, top bar, and the page in between. */
export function AppShell({ store, account, counts, children }: Props) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-black font-display text-cream">
      <aside className="hidden w-[260px] shrink-0 border-r border-panel-3 bg-[#0d0d0d] lg:block">
        <Sidebar store={store} counts={counts} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label={n.close} onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/70" />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-panel-3 bg-[#0d0d0d]">
            <button type="button" onClick={() => setDrawer(false)} aria-label={n.close} className="absolute top-6 right-4 grid size-10 place-items-center rounded-lg text-stone hover:text-cream">
              <X className="size-5" aria-hidden="true" />
            </button>
            <Sidebar store={store} counts={counts} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar account={account} counts={counts} onMenu={() => setDrawer(true)} />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
