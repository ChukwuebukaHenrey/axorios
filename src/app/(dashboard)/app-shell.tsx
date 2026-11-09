"use client";

import {
  BarChart3,
  Bell,
  Check,
  ChevronsUpDown,
  ExternalLink,
  Eye,
  Home,
  Inbox,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Palette,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/messages";
import type { PageKey } from "@/modules/agent/pages";
import { Mascot } from "./_axori/mascot";
import { AxoriPanel } from "./_axori/panel";
import { AxoriProvider, typingIn, useAxori } from "./_axori/provider";
import { newBusiness, signOut, switchStore } from "./shell-actions";

const n = t.app.nav;

type StoreInfo = { id: string; name: string | null; slug: string; live: boolean; draftUrl: string | null };
type Props = {
  store: StoreInfo;
  stores: { id: string; name: string; live: boolean; currency: string }[];
  account: { email: string; name: string | null };
  counts: { orders: number; inbox: number };
  approvals: { threadId: string; title: string; count: number }[];
  pageLabels: Record<PageKey, string>;
  children: ReactNode;
};

type NavItem = { href: string; label: string; icon: LucideIcon; count?: number; soon?: boolean; exact?: boolean };

function navGroups(counts: Props["counts"]): { label: string | null; items: NavItem[] }[] {
  return [
    {
      label: null,
      items: [
        { href: "/dashboard", label: n.home, icon: Home, exact: true },
        { href: "/dashboard/ai", label: n.ai, icon: Sparkles },
      ],
    },
    {
      label: n.groupBusiness,
      items: [
        { href: "/dashboard/store", label: n.store, icon: Store },
        { href: "/dashboard/orders", label: n.orders, icon: Package, count: counts.orders },
        { href: "/dashboard/customers", label: n.customers, icon: Users },
        { href: "/dashboard/inbox", label: n.inbox, icon: Inbox, count: counts.inbox },
      ],
    },
    {
      label: n.groupGrow,
      items: [
        { href: "/dashboard/campaigns", label: n.marketing, icon: Megaphone },
        { href: "/dashboard/money", label: n.money, icon: Wallet },
        { href: "/dashboard/analytics", label: n.analytics, icon: BarChart3 },
      ],
    },
    { label: n.groupWorkspace, items: [{ href: "/dashboard/design", label: n.design, icon: Palette, soon: true }] },
  ];
}

function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const on = isActive(pathname, item);
  const Icon = item.icon;
  const base = "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] transition";
  if (item.soon) {
    return (
      <span className={`${base} cursor-default text-cream/35`} aria-disabled="true">
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="flex-1">{item.label}</span>
        <span className="rounded-full border border-panel-3 px-1.5 text-[10px] tracking-wide uppercase">soon</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={on ? "page" : undefined}
      className={`${base} ${on ? "border border-lime/25 bg-[#2b3118] text-cream" : "border border-transparent text-cream/75 hover:bg-panel-2 hover:text-cream"}`}
    >
      <Icon className={`size-[18px] shrink-0 ${on ? "text-lime" : ""}`} aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {item.count ? <span className="min-w-6 rounded-full bg-panel-3 px-1.5 py-0.5 text-center text-xs text-cream">{item.count}</span> : null}
    </Link>
  );
}

function Sidebar({ counts, onNavigate }: { counts: Props["counts"]; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col px-4 py-5">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 text-cream" onClick={onNavigate}>
        <Logo className="size-9" />
        <span className="text-[22px] font-medium tracking-tight">{t.marketing.brand}</span>
      </Link>
      <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        {navGroups(counts).map((group, i) => (
          <div key={group.label ?? i}>
            {group.label && <p className="mb-1.5 px-3 text-[11px] font-medium tracking-wider text-stone uppercase">{group.label}</p>}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-panel-3 pt-3">
        <NavLink item={{ href: "/dashboard/integrations", label: n.settings, icon: Settings }} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function StoreSwitcher({ store, stores }: Pick<Props, "store" | "stores">) {
  const router = useRouter();
  const { openThread } = useAxori();
  const [pending, start] = useTransition();
  const current = stores.find((s) => s.id === store.id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex h-11 max-w-[230px] min-w-0 items-center gap-2.5 rounded-xl border border-panel-3 bg-panel-2 px-2.5 text-left text-cream transition hover:border-cream/25 disabled:opacity-60"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-lime text-sm font-semibold text-black">
          {(store.name ?? n.unnamed).slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{store.name ?? n.unnamed}</span>
          <span className="block text-[11px] text-stone">
            {store.live ? n.live : n.draft} · {current?.currency}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-stone" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-stone">{n.stores}</DropdownMenuLabel>
        {stores.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() =>
              s.id !== store.id &&
              start(async () => {
                await switchStore(s.id);
                router.refresh();
              })
            }
          >
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="text-xs text-stone">{s.currency}</span>
            {s.id === store.id && <Check className="size-4 text-lime" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {store.live && (
          <DropdownMenuItem asChild>
            <a href={`/s/${store.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" /> {n.viewLive}
            </a>
          </DropdownMenuItem>
        )}
        {store.draftUrl && (
          <DropdownMenuItem asChild>
            <a href={store.draftUrl} target="_blank" rel="noreferrer">
              <Eye aria-hidden="true" /> {n.viewDraft}
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() =>
            start(async () => {
              await newBusiness();
              router.refresh();
              openThread(null);
            })
          }
        >
          <Plus aria-hidden="true" /> {n.newBusiness}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { ask, setOpen } = useAxori();
  const [q, setQ] = useState("");
  const pages: { href: string; label: string; icon: LucideIcon }[] = navGroups({ orders: 0, inbox: 0 })
    .flatMap((g) => g.items)
    .filter((i) => !i.soon)
    .map(({ href, label, icon }) => ({ href, label, icon }));
  const go = (href: string) => {
    onOpenChange(false);
    setQ("");
    router.push(href);
  };
  const query = q.trim();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={n.searchOpen} description={n.searchPlaceholder} className="border-panel-3 bg-panel-2 text-cream sm:max-w-xl">
      <CommandInput value={q} onValueChange={setQ} placeholder={n.searchPlaceholder} />
      <CommandList>
        <CommandEmpty>{n.noResults}</CommandEmpty>
        <CommandGroup>
          <CommandItem
            forceMount
            value="__ask"
            onSelect={() => {
              onOpenChange(false);
              setQ("");
              if (query) ask(query);
              else setOpen(true);
            }}
          >
            <Mascot state="idle" size={22} />
            {query ? n.askAiAbout.replace("{q}", query) : n.askAi}
          </CommandItem>
          {query && (
            <CommandItem forceMount value="__orders" onSelect={() => go(`/dashboard/orders?q=${encodeURIComponent(query)}`)}>
              <Package aria-hidden="true" /> {n.searchIn.replace("{where}", n.orders.toLowerCase()).replace("{q}", query)}
            </CommandItem>
          )}
        </CommandGroup>
        <CommandGroup heading={n.pagesGroup}>
          {pages.map(({ href, label, icon: Icon }) => (
            <CommandItem key={href} value={label} onSelect={() => go(href)}>
              <Icon aria-hidden="true" /> {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function TopBar({ store, stores, account, counts, approvals, onMenu }: Omit<Props, "children" | "pageLabels"> & { onMenu: () => void }) {
  const { setOpen, open, openThread, mascot } = useAxori();
  const [search, setSearch] = useState(false);
  const initials = (account.name ?? account.email).slice(0, 2).toUpperCase();
  const waiting = approvals.reduce((sum, a) => sum + a.count, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !typingIn(e.target)) {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const iconButton = "relative grid size-11 place-items-center rounded-xl border border-panel-3 bg-panel-2 text-cream transition hover:border-cream/25";

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
      <button type="button" onClick={onMenu} aria-label={n.menu} className="grid size-11 place-items-center rounded-xl bg-panel-2 text-cream lg:hidden">
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <StoreSwitcher store={store} stores={stores} />
      <button
        type="button"
        onClick={() => setSearch(true)}
        className="hidden h-11 w-full max-w-[380px] items-center gap-3 rounded-xl border border-panel-3 bg-panel-2 px-3.5 text-left text-sm text-stone transition hover:border-cream/25 md:flex"
      >
        <Search className="size-4.5" aria-hidden="true" />
        <span className="flex-1">{n.searchOpen}</span>
        <kbd className="rounded-md border border-panel-3 px-1.5 py-0.5 font-mono text-[11px]">Ctrl K</kbd>
      </button>
      <SearchPalette open={search} onOpenChange={setSearch} />

      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={() => setSearch(true)} aria-label={n.searchOpen} className={`${iconButton} md:hidden`}>
          <Search className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={t.app.axori.open}
          aria-expanded={open}
          className="hidden h-11 items-center gap-2 rounded-xl border border-lime/30 bg-[#1c2112] pr-3 pl-1.5 text-sm font-medium text-cream transition hover:border-lime/60 sm:flex"
        >
          <Mascot state={mascot} size={32} />
          {t.app.axori.title}
          <kbd className="rounded-md border border-lime/20 px-1.5 py-0.5 font-mono text-[11px] text-lime/80">{t.app.axori.shortcut}</kbd>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`${n.approvals}: ${waiting}`} className={iconButton}>
            <ShieldCheck className="size-5" aria-hidden="true" />
            {waiting > 0 && (
              <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-lime px-1 text-[11px] font-bold text-black">{waiting}</span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>{n.approvals}</DropdownMenuLabel>
            {approvals.length === 0 && <p className="px-2 py-2 text-sm text-stone">{n.approvalsEmpty}</p>}
            {approvals.map((a) => (
              <DropdownMenuItem key={a.threadId} onSelect={() => openThread(a.threadId)}>
                <span className="min-w-0 flex-1 truncate">{n.approvalsWaiting.replace("{count}", String(a.count)).replace("{thread}", a.title)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger aria-label={n.notifications} className={`${iconButton} hidden sm:grid`}>
            <Bell className="size-5" aria-hidden="true" />
            {counts.inbox > 0 && <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-lime" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-3">
            <p className="text-sm text-cream">{counts.inbox > 0 ? n.waiting.replace("{count}", String(counts.inbox)) : n.caughtUp}</p>
            {counts.inbox > 0 && (
              <Link href="/dashboard/inbox" className="mt-2 inline-block text-sm text-lime underline underline-offset-4">
                {n.openInbox}
              </Link>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger aria-label={n.account} className="grid size-11 place-items-center rounded-full bg-panel-3 text-sm font-medium text-cream">
            {initials}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="truncate font-normal text-stone">{account.email}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/integrations">
                <Settings aria-hidden="true" /> {n.settings}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <button type="submit" className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-cream hover:bg-panel-3">
                <LogOut className="size-4 text-stone" aria-hidden="true" /> {n.signOut}
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/** Phones: Home, Orders, Inbox, Marketing, More. */
function BottomBar({ counts, onMore }: { counts: Props["counts"]; onMore: () => void }) {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: "/dashboard", label: n.home, icon: Home, exact: true },
    { href: "/dashboard/orders", label: n.orders, icon: Package, count: counts.orders },
    { href: "/dashboard/inbox", label: n.inbox, icon: Inbox, count: counts.inbox },
    { href: "/dashboard/campaigns", label: n.marketing, icon: Megaphone },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-panel-3 bg-[#0d0d0d]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {items.map((item) => {
        const on = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] ${on ? "text-lime" : "text-stone"}`}>
            <Icon className="size-5" aria-hidden="true" />
            {item.label}
            {item.count ? <span className="absolute top-2 left-[calc(50%+6px)] size-2 rounded-full bg-lime" /> : null}
          </Link>
        );
      })}
      <button type="button" onClick={onMore} className="flex flex-col items-center justify-center gap-0.5 text-[11px] text-stone">
        <Menu className="size-5" aria-hidden="true" />
        {n.more}
      </button>
    </nav>
  );
}

/** Phones: tap to type, hold to talk (spec v2, "Opening it"). */
function FloatingAxori() {
  const { setOpen, setHolding, holding, mascot, open } = useAxori();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  if (open && !holding) return null;

  const down = () => {
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      setOpen(true);
      setHolding(true);
    }, 350);
  };
  const up = () => {
    if (timer.current) clearTimeout(timer.current);
    if (held.current) setHolding(false);
    else setOpen(true);
  };
  return (
    <button
      type="button"
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={() => held.current && setHolding(false)}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={t.app.axori.holdToTalk}
      className="fixed right-4 bottom-20 z-[60] grid size-16 touch-none place-items-center rounded-full border border-lime/40 bg-[#1c2112] shadow-xl shadow-black/50 select-none lg:hidden"
    >
      <Mascot state={holding ? "listening" : mascot} size={52} />
    </button>
  );
}

/** The seller workspace frame: grouped sidebar, global top bar, Axori AI panel, and the phone bottom bar. */
export function AppShell({ pageLabels, children, ...props }: Props) {
  const [drawer, setDrawer] = useState(false);
  return (
    <AxoriProvider pageLabels={pageLabels}>
      <div className="flex h-dvh overflow-hidden bg-black font-display text-cream">
        <aside className="hidden w-[248px] shrink-0 border-r border-panel-3 bg-[#0d0d0d] lg:block">
          <Sidebar counts={props.counts} />
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label={n.close} onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/70" />
            <aside className="absolute inset-y-0 left-0 w-[272px] border-r border-panel-3 bg-[#0d0d0d]">
              <button type="button" onClick={() => setDrawer(false)} aria-label={n.close} className="absolute top-5 right-3 grid size-10 place-items-center rounded-lg text-stone hover:text-cream">
                <X className="size-5" aria-hidden="true" />
              </button>
              <Sidebar counts={props.counts} onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar {...props} onMenu={() => setDrawer(true)} />
          <div className="flex min-h-0 flex-1 flex-col pb-16 lg:pb-0">{children}</div>
        </div>
      </div>
      <AxoriPanel storeName={props.store.name ?? props.store.slug} greetingName={props.account.name ?? ""} />
      <FloatingAxori />
      <BottomBar counts={props.counts} onMore={() => setDrawer(true)} />
    </AxoriProvider>
  );
}
