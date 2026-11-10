"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PageKey } from "@/modules/agent/pages";
import type { MascotState } from "./mascot";

/** What a chip shows the seller. Only `kind` and `id` (or the page key) go to the server, which re-reads the object. */
export type Chip =
  | { kind: "page"; page: PageKey; label: string }
  | { kind: "order" | "product" | "customer" | "media"; id: string; label: string };

export const chipKey = (c: Chip) => (c.kind === "page" ? `page:${c.page}` : `${c.kind}:${c.id}`);
export const chipPayload = (c: Chip) => (c.kind === "page" ? { kind: c.kind, page: c.page } : { kind: c.kind, id: c.id });

const PAGE_FOR_PATH: [string, PageKey][] = [
  ["/dashboard/ai", "ai"],
  ["/dashboard/orders", "orders"],
  ["/dashboard/customers", "customers"],
  ["/dashboard/inbox", "inbox"],
  ["/dashboard/campaigns", "marketing"],
  ["/dashboard/marketing", "marketing"],
  ["/dashboard/money", "money"],
  ["/dashboard/analytics", "analytics"],
  ["/dashboard/store", "store"],
  ["/dashboard/design", "design"],
  ["/dashboard/settings", "settings"],
  ["/dashboard/integrations", "settings"],
];

export function pageFor(pathname: string): PageKey {
  return PAGE_FOR_PATH.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "home";
}

type Ctx = {
  open: boolean;
  setOpen: (open: boolean) => void;
  threadId: string | null;
  openThread: (id: string | null) => void;
  /** Opens the panel and sends `text` as the seller's message (search's "Ask Axori AI"). */
  ask: (text: string) => void;
  pending: string | null;
  takePending: () => string | null;
  chips: Chip[];
  /** The chips at send time, for the chat transport. */
  getChips: () => Chip[];
  addChip: (chip: Chip) => void;
  removeChip: (key: string) => void;
  dropChip: (key: string) => void;
  mascot: MascotState;
  setMascot: (state: MascotState) => void;
  /** Hold-to-talk from the mobile button: the chat records while this is true. */
  holding: boolean;
  setHolding: (holding: boolean) => void;
  pageLabels: Record<PageKey, string>;
};

const AxoriContext = createContext<Ctx | null>(null);

export function useAxori() {
  const ctx = useContext(AxoriContext);
  if (!ctx) throw new Error("useAxori outside AxoriProvider");
  return ctx;
}

/** Keyboard shortcuts don't fire while typing, except Esc (spec v2, "Opening it"). */
export function typingIn(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

export function AxoriProvider({ children, pageLabels }: { children: ReactNode; pageLabels: Record<PageKey, string> }) {
  const pathname = usePathname();
  const [open, setOpenState] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [objects, setObjects] = useState<Chip[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [mascot, setMascot] = useState<MascotState>("idle");
  const [holding, setHolding] = useState(false);

  const page = pageFor(pathname);
  // A chip the seller removed comes back when they move to another page.
  const [removedOn, setRemovedOn] = useState(pathname);
  if (removedOn !== pathname) {
    setRemovedOn(pathname);
    setRemoved(new Set());
  }
  const chips = useMemo(() => {
    const all: Chip[] = [...(page === "ai" ? [] : [{ kind: "page", page, label: pageLabels[page] } as Chip]), ...objects];
    return all.filter((c) => !removed.has(chipKey(c)));
  }, [page, pageLabels, objects, removed]);

  const chipsRef = useRef(chips);
  useEffect(() => {
    chipsRef.current = chips;
  }, [chips]);
  const getChips = useCallback(() => chipsRef.current, []);

  const setOpen = useCallback((next: boolean) => setOpenState(next), []);
  const openThread = useCallback((id: string | null) => {
    setThreadId(id);
    setOpenState(true);
  }, []);
  const ask = useCallback((text: string) => {
    setPending(text);
    setOpenState(true);
  }, []);
  const takePending = useCallback(() => {
    const text = pending;
    if (text !== null) setPending(null);
    return text;
  }, [pending]);
  const addChip = useCallback((chip: Chip) => setObjects((list) => (list.some((c) => chipKey(c) === chipKey(chip)) ? list : [...list, chip])), []);
  const dropChip = useCallback((key: string) => setObjects((list) => list.filter((c) => chipKey(c) !== key)), []);
  const removeChip = useCallback((key: string) => {
    setRemoved((set) => new Set(set).add(key));
    setObjects((list) => list.filter((c) => chipKey(c) !== key));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpenState(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j" && !typingIn(e.target)) {
        e.preventDefault();
        setOpenState((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, threadId, openThread, ask, pending, takePending, chips, getChips, addChip, removeChip, dropChip, mascot, setMascot, holding, setHolding, pageLabels }),
    [open, setOpen, threadId, openThread, ask, pending, takePending, chips, getChips, addChip, removeChip, dropChip, mascot, holding, pageLabels],
  );
  return <AxoriContext.Provider value={value}>{children}</AxoriContext.Provider>;
}

/** A page puts its object in front of Axori AI while it's on screen, e.g. the order being viewed. */
export function AxoriSees({ chip }: { chip: Chip }) {
  const { addChip, dropChip } = useAxori();
  const key = chipKey(chip);
  useEffect(() => {
    addChip(chip);
    return () => dropChip(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
