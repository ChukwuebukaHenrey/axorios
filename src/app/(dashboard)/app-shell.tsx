"use client";

import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  ChevronsUpDown,
  CornerDownLeft,
  ExternalLink,
  Eye,
  Home,
  Inbox,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  MoreHorizontal,
  Package,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/lib/messages";
import { cn } from "@/lib/utils";
import type { PageKey } from "@/modules/agent/pages";
import { Mascot } from "./_axori/mascot";
import { AxoriPanel } from "./_axori/panel";
import { AxoriProvider, typingIn, useAxori } from "./_axori/provider";
import { findDestinations } from "./search-index";
import { newBusiness, signOut, switchStore } from "./shell-actions";

const n = t.app.nav;
const SIDEBAR_KEY = "axorios.sidebar.collapsed";

/** Sidebar collapse is a per-browser preference, read from localStorage without a hydration mismatch. */
function readSidebar() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}
function subscribeSidebar(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_KEY, onChange);
  };
}

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

type NavItem = { href: string; label: string; icon: LucideIcon | "axori"; count?: number; exact?: boolean };

function navGroups(counts: Props["counts"]): { label: string | null; items: NavItem[] }[] {
  return [
    {
      label: null,
      items: [
        { href: "/dashboard", label: n.home, icon: Home, exact: true },
        { href: "/dashboard/ai", label: n.ai, icon: "axori" },
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
    { label: n.groupWorkspace, items: [{ href: "/dashboard/design", label: n.design, icon: Palette }] },
  ];
}
const ALL_ITEMS = [...navGroups({ orders: 0, inbox: 0 }).flatMap((g) => g.items), { href: "/dashboard/settings", label: n.settings, icon: Settings }];

function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function NavIcon({ icon, on }: { icon: NavItem["icon"]; on: boolean }) {
  if (icon === "axori") return <Mascot state="idle" size={20} className="-m-px shrink-0" />;
  const Icon = icon;
  return <Icon className={cn("size-4 shrink-0", on ? "text-lime" : "text-stone group-hover:text-cream")} aria-hidden="true" />;
}

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const on = isActive(pathname, item);
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={on ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-md text-sm transition-colors",
        collapsed ? "w-8 justify-center" : "px-2.5",
        on ? "bg-panel-2 text-cream" : "text-cream/70 hover:bg-panel-2/60 hover:text-cream",
      )}
    >
      {on && <span className="absolute top-1.5 bottom-1.5 -left-2 w-0.5 rounded-full bg-lime" aria-hidden="true" />}
      <NavIcon icon={item.icon} on={on} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.count ? <span className="rounded bg-panel-3 px-1.5 text-[11px] text-cream tabular-nums">{item.count}</span> : null}
      {collapsed && item.count ? <span className="absolute top-1 right-1 size-1.5 rounded-full bg-lime" aria-hidden="true" /> : null}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {item.label}
        {item.count ? ` · ${item.count}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

function StoreSwitcher({ store, stores, collapsed }: Pick<Props, "store" | "stores"> & { collapsed: boolean }) {
  const router = useRouter();
  const { openThread } = useAxori();
  const [pending, start] = useTransition();
  const current = stores.find((s) => s.id === store.id);
  const initial = (store.name ?? n.unnamed).slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        aria-label={`${n.stores}: ${store.name ?? n.unnamed}`}
        className={cn(
          "flex min-w-0 items-center gap-2.5 rounded-md text-left text-cream transition-colors hover:bg-panel-2 disabled:opacity-60 data-[state=open]:bg-panel-2",
          collapsed ? "size-9 justify-center" : "h-11 w-full px-2",
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-lime text-sm font-semibold text-black">
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : initial}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{store.name ?? n.unnamed}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-stone">
                <span className={cn("size-1.5 rounded-full", store.live ? "bg-success" : "bg-stone/60")} aria-hidden="true" />
                {store.live ? n.live : n.draft} · {current?.currency}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-stone" aria-hidden="true" />
          </>
        )}
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
            <span className="grid size-5 shrink-0 place-items-center rounded bg-panel-3 text-[11px] font-semibold">{s.name.slice(0, 1).toUpperCase()}</span>
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

/** Log out from any page: the menu item runs the server action in a transition and shows it working. */
function AccountMenu({ account, collapsed }: { account: Props["account"]; collapsed: boolean }) {
  const router = useRouter();
  const [leaving, start] = useTransition();
  const initials = (account.name ?? account.email).slice(0, 2).toUpperCase();
  const logOut = () =>
    start(async () => {
      try {
        await signOut();
      } finally {
        // signOut redirects; this covers a stale action or a session that was already gone.
        router.replace("/sign-in");
        router.refresh();
      }
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={n.account}
        className={cn(
          "flex min-w-0 items-center gap-2.5 rounded-md text-left transition-colors hover:bg-panel-2 data-[state=open]:bg-panel-2",
          collapsed ? "size-9 justify-center" : "h-10 w-full px-2",
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-panel-3 text-[11px] font-medium text-cream">{initials}</span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] text-cream/80">{account.name ?? account.email}</span>
            {leaving ? <Loader2 className="size-4 animate-spin text-stone" aria-hidden="true" /> : <MoreHorizontal className="size-4 text-stone" aria-hidden="true" />}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "start" : "end"} side="top" className="w-60">
        <DropdownMenuLabel className="truncate font-normal text-stone">{account.email}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings aria-hidden="true" /> {n.settings}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={leaving}
          onSelect={(e) => {
            e.preventDefault();
            logOut();
          }}
        >
          {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />} {n.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Sidebar({
  store,
  stores,
  account,
  counts,
  collapsed,
  onToggle,
  onSearch,
  onNavigate,
}: Pick<Props, "store" | "stores" | "account" | "counts"> & { collapsed: boolean; onToggle?: () => void; onSearch: () => void; onNavigate?: () => void }) {
  return (
    <div className={cn("flex h-full flex-col", collapsed ? "items-center px-2" : "px-3")}>
      <div className={cn("flex h-14 shrink-0 items-center", collapsed ? "justify-center" : "justify-between gap-2 pl-1")}>
        <Link href="/dashboard/ai" onClick={onNavigate} title={t.app.axori.newChatHint} aria-label={`${t.marketing.brand} · ${t.app.axori.newChatHint}`} className="flex items-center gap-2 rounded-md text-cream">
          <Logo className="size-7" />
          {!collapsed && <span className="text-[17px] font-medium tracking-tight">{t.marketing.brand}</span>}
        </Link>
        {onToggle && !collapsed && (
          <button type="button" onClick={onToggle} aria-label={n.collapse} title={n.collapse} className="grid size-7 place-items-center rounded-md text-stone transition-colors hover:bg-panel-2 hover:text-cream">
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={cn("flex flex-col gap-1.5 border-y border-panel-3 py-2.5", collapsed ? "items-center" : "")}>
        <StoreSwitcher store={store} stores={stores} collapsed={collapsed} />
        <button
          type="button"
          onClick={onSearch}
          aria-label={n.searchOpen}
          className={cn(
            "flex items-center gap-2 rounded-md border border-panel-3 bg-panel text-sm text-stone transition-colors hover:border-cream/20 hover:text-cream",
            collapsed ? "size-8 justify-center" : "h-8 px-2.5",
          )}
        >
          <Search className="size-3.5" aria-hidden="true" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{n.find}</span>
              <kbd className="rounded border border-panel-3 px-1 font-mono text-[10px]">Ctrl K</kbd>
            </>
          )}
        </button>
      </div>

      <nav className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto py-2 [scrollbar-width:thin]", collapsed ? "items-center" : "")}>
        {navGroups(counts).map((group, i) => (
          <div key={group.label ?? i} className={cn("flex flex-col gap-px py-1.5", i > 0 && "border-t border-panel-3/70")}>
            {group.label && !collapsed && <p className="px-2.5 pt-1 pb-1 text-[11px] font-medium text-stone/80">{group.label}</p>}
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className={cn("flex shrink-0 flex-col gap-1 border-t border-panel-3 py-2.5", collapsed ? "items-center" : "")}>
        <NavLink item={{ href: "/dashboard/settings", label: n.settings, icon: Settings }} collapsed={collapsed} onNavigate={onNavigate} />
        <AccountMenu account={account} collapsed={collapsed} />
        {onToggle && collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={onToggle} aria-label={n.expand} className="grid size-8 place-items-center rounded-md text-stone transition-colors hover:bg-panel-2 hover:text-cream">
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{n.expand}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/**
 * Ctrl/⌘+K. Finds views buried inside sections (Store › Context, Money › Withdrawals…), then offers
 * to search orders and customers for the text, or hand it to Axori AI. Closes on every choice.
 */
function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { ask } = useAxori();
  const [q, setQ] = useState("");
  const query = q.trim();
  const found = findDestinations(query);
  const close = () => {
    onOpenChange(false);
    setQ("");
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : close())}
      title={n.searchOpen}
      description={n.searchPlaceholder}
      shouldFilter={false}
      className="border-panel-3 bg-panel-2 text-cream sm:max-w-xl"
    >
      <CommandInput value={q} onValueChange={setQ} placeholder={n.searchPlaceholder} />
      <CommandList className="max-h-[min(420px,60vh)]">
        {query && found.length === 0 && <CommandEmpty>{n.noResults}</CommandEmpty>}
        {found.length > 0 && (
          <CommandGroup heading={n.goTo}>
            {found.map((d) => (
              <CommandItem key={d.href} value={d.href} onSelect={() => go(d.href)}>
                <ArrowRight className="text-stone" aria-hidden="true" />
                <span className="flex-1 truncate">{d.label}</span>
                {d.section !== d.label && <span className="text-xs text-stone">{d.section}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {query && (
          <CommandGroup heading={n.searchData}>
            <CommandItem value="__orders" onSelect={() => go(`/dashboard/orders?q=${encodeURIComponent(query)}`)}>
              <Package aria-hidden="true" /> {n.searchIn.replace("{where}", n.orders.toLowerCase()).replace("{q}", query)}
            </CommandItem>
            <CommandItem value="__customers" onSelect={() => go(`/dashboard/customers?q=${encodeURIComponent(query)}`)}>
              <Users aria-hidden="true" /> {n.searchIn.replace("{where}", n.customers.toLowerCase()).replace("{q}", query)}
            </CommandItem>
            <CommandItem
              value="__ask"
              onSelect={() => {
                close();
                ask(query);
              }}
            >
              <Mascot state="idle" size={18} />
              <span className="flex-1">{n.askAiAbout.replace("{q}", query)}</span>
              <CornerDownLeft className="text-stone" aria-hidden="true" />
            </CommandItem>
          </CommandGroup>
        )}
        {!query && (
          <CommandGroup heading={n.quickLinks}>
            {ALL_ITEMS.map((item) => (
              <CommandItem key={item.href} value={item.href} onSelect={() => go(item.href)}>
                {item.icon === "axori" ? <Mascot state="idle" size={18} /> : <item.icon aria-hidden="true" />}
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function TopBar({ counts, approvals, onMenu, onSearch }: Pick<Props, "counts" | "approvals"> & { onMenu: () => void; onSearch: () => void }) {
  const pathname = usePathname();
  const { setOpen, open, openThread, mascot } = useAxori();
  const waiting = approvals.reduce((sum, a) => sum + a.count, 0);
  const here = [...ALL_ITEMS].sort((a, b) => b.href.length - a.href.length).find((item) => isActive(pathname, item));
  const iconButton =
    "relative grid size-9 place-items-center rounded-md border border-panel-3 lg:size-8 text-stone transition-colors hover:border-cream/20 hover:bg-panel-2 hover:text-cream data-[state=open]:bg-panel-2 data-[state=open]:text-cream";

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-panel-3 bg-black/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-5 [@supports(padding:env(safe-area-inset-top))]:h-[calc(3.5rem+env(safe-area-inset-top))]">
      <button type="button" onClick={onMenu} aria-label={n.menu} className="-ml-1 grid size-10 place-items-center rounded-md text-cream hover:bg-panel-2 lg:hidden">
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <Link href="/dashboard/ai" aria-label={t.app.axori.newChatHint} className="lg:hidden">
        <Logo className="size-6" />
      </Link>
      <h1 className="truncate text-sm font-medium text-cream">{here?.label ?? n.home}</h1>

      <div className="ml-auto flex items-center gap-1.5">
        <button type="button" onClick={onSearch} aria-label={n.searchOpen} className={cn(iconButton, "lg:hidden")}>
          <Search className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={t.app.axori.open}
          aria-expanded={open}
          className="hidden h-8 items-center gap-1.5 rounded-md border border-lime/25 bg-[#1c2112] pr-2 pl-1 text-[13px] font-medium text-cream transition-colors hover:border-lime/50 sm:flex"
        >
          <Mascot state={mascot} size={24} />
          {t.app.axori.title}
          <kbd className="rounded border border-lime/20 px-1 font-mono text-[10px] text-lime/80">{t.app.axori.shortcut}</kbd>
        </button>

        <span className="mx-1 hidden h-5 w-px bg-panel-3 sm:block" aria-hidden="true" />

        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`${n.approvals}: ${waiting}`} className={iconButton}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {waiting > 0 && <span className="absolute -top-1.5 -right-1.5 grid min-w-4 place-items-center rounded bg-lime px-1 text-[10px] font-bold text-black">{waiting}</span>}
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
          <DropdownMenuTrigger aria-label={n.notifications} className={iconButton}>
            <Bell className="size-4" aria-hidden="true" />
            {counts.inbox > 0 && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-lime" aria-hidden="true" />}
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
      </div>
    </header>
  );
}

/** Bottom bar height plus its gap; the workspace keeps this much clear at the bottom on phones. */
const BAR_SPACE = "pb-[calc(env(safe-area-inset-bottom)+5.5rem)]";

/**
 * Phones: one bottom bar on every workspace page. Home, Orders, Axori AI in the middle (tap to type, hold to talk),
 * Inbox, and More (the full menu). Axori AI lives in the bar, so nothing floats over charts, tables or send buttons.
 */
function BottomBar({ counts, onMore }: { counts: Props["counts"]; onMore: () => void }) {
  const pathname = usePathname();
  const items: (NavItem & { icon: LucideIcon })[] = [
    { href: "/dashboard", label: n.home, icon: Home, exact: true },
    { href: "/dashboard/orders", label: n.orders, icon: Package, count: counts.orders },
    { href: "/dashboard/inbox", label: n.inbox, icon: Inbox, count: counts.inbox },
  ];
  const slot = "relative flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-lime/60";
  const link = (item: (typeof items)[number]) => {
    const on = isActive(pathname, item);
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined} className={cn(slot, on ? "bg-panel-2 text-cream" : "text-stone active:bg-panel-2/60")}>
        <Icon className={cn("size-5", on && "text-lime")} aria-hidden="true" />
        {item.label}
        {item.count ? <span className="absolute top-1.5 left-[calc(50%+7px)] size-2 rounded-full bg-lime ring-2 ring-[#141414]" aria-hidden="true" /> : null}
      </Link>
    );
  };
  return (
    <nav
      aria-label={n.bottomBar}
      data-bottom-bar
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-40 flex h-16 items-center gap-1 rounded-2xl border border-panel-3 bg-[#141414]/95 px-1.5 shadow-[0_8px_32px_rgb(0_0_0/0.55)] backdrop-blur-md lg:hidden"
    >
      {link(items[0])}
      {link(items[1])}
      <AxoriBarButton />
      {link(items[2])}
      <button type="button" onClick={onMore} className={cn(slot, "text-stone active:bg-panel-2/60")}>
        <Menu className="size-5" aria-hidden="true" />
        {n.more}
      </button>
    </nav>
  );
}

/** The bar's middle button: tap opens Axori AI (or the composer, on its own page); press and hold records a voice note. */
function AxoriBarButton() {
  const { setOpen, setHolding, holding, mascot, open } = useAxori();
  const onPage = usePathname()?.startsWith("/dashboard/ai");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const down = () => {
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      if (!onPage) setOpen(true);
      setHolding(true);
    }, 350);
  };
  const up = () => {
    if (timer.current) clearTimeout(timer.current);
    if (held.current) return setHolding(false);
    if (onPage) document.getElementById("axori-input-page")?.focus();
    else setOpen(!open);
  };
  return (
    <button
      type="button"
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={() => {
        if (timer.current) clearTimeout(timer.current);
        if (held.current) setHolding(false);
      }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${t.app.axori.title}: ${t.app.axori.holdToTalk}`}
      aria-pressed={open || onPage}
      className="relative mx-0.5 grid size-14 shrink-0 touch-none place-items-center rounded-2xl border border-lime/35 bg-[#1c2112] transition-transform outline-none select-none focus-visible:ring-2 focus-visible:ring-lime/60 active:scale-95"
    >
      <Mascot state={holding ? "listening" : mascot} size={40} />
    </button>
  );
}

/** The seller workspace frame: collapsible sidebar, bordered top bar, Axori AI panel, and the phone bottom bar. */
export function AppShell({ pageLabels, children, ...props }: Props) {
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const toggle = useCallback(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, readSidebar() ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(SIDEBAR_KEY));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !typingIn(e.target)) {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && !typingIn(e.target)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const sidebarProps = { store: props.store, stores: props.stores, account: props.account, counts: props.counts, onSearch: () => setSearch(true) };

  return (
    <AxoriProvider pageLabels={pageLabels}>
      <TooltipProvider delayDuration={150}>
        <div className="flex h-dvh overflow-hidden bg-black font-display text-cream">
          <aside className={cn("hidden shrink-0 border-r border-panel-3 bg-[#0a0a0a] transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block", collapsed ? "w-[60px]" : "w-[240px]")}>
            <Sidebar {...sidebarProps} collapsed={collapsed} onToggle={toggle} />
          </aside>

          {drawer && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button type="button" aria-label={n.close} onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/70" />
              <aside className="absolute inset-y-0 left-0 w-[min(288px,86vw)] border-r border-panel-3 bg-[#0a0a0a] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
                <button type="button" onClick={() => setDrawer(false)} aria-label={n.close} className="absolute top-3.5 right-3 z-10 grid size-8 place-items-center rounded-md text-stone hover:text-cream">
                  <X className="size-4" aria-hidden="true" />
                </button>
                <Sidebar
                  {...sidebarProps}
                  collapsed={false}
                  onSearch={() => {
                    setDrawer(false);
                    setSearch(true);
                  }}
                  onNavigate={() => setDrawer(false)}
                />
              </aside>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar counts={props.counts} approvals={props.approvals} onMenu={() => setDrawer(true)} onSearch={() => setSearch(true)} />
            <div className={cn("flex min-h-0 flex-1 flex-col lg:pb-0", BAR_SPACE)}>{children}</div>
          </div>
        </div>
        <SearchPalette open={search} onOpenChange={setSearch} />
        <AxoriPanel storeName={props.store.name ?? props.store.slug} greetingName={props.account.name ?? ""} />
        <BottomBar counts={props.counts} onMore={() => setDrawer(true)} />
      </TooltipProvider>
    </AxoriProvider>
  );
}
