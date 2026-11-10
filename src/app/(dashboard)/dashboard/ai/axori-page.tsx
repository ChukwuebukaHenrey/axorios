"use client";

import { History, PanelLeftClose, PanelLeftOpen, Plus, Search } from "lucide-react";
import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/lib/messages";
import { AxoriChat } from "../../_axori/chat";
import { Mascot } from "../../_axori/mascot";
import { useAxori } from "../../_axori/provider";
import { ThreadList, useThreads } from "../../_axori/threads";

const a = t.app.axori;
const COLLAPSED_KEY = "axorios.chats.collapsed";

/** Whether the history column is folded away: a per-browser preference, read without a hydration mismatch. */
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}
function subscribeCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(COLLAPSED_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(COLLAPSED_KEY, onChange);
  };
}
function setCollapsed(next: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(COLLAPSED_KEY));
}

const railButton =
  "grid size-8 place-items-center rounded-md text-stone transition-colors outline-none hover:bg-panel-2 hover:text-cream focus-visible:ring-2 focus-visible:ring-lime/50";

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onClick} aria-label={label} className={railButton}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Axori AI full page: chat history on the left, the chat on the right. Opens on a new, unsaved chat; earlier chats
 * stay one click away. Desktop folds the history to a rail; phones open it as a drawer. Same threads as the panel.
 */
export function AxoriPage({
  initialThread,
  initialPrompt,
  storeName,
  greetingName,
}: {
  initialThread: string | null;
  initialPrompt: string;
  storeName: string;
  greetingName: string;
}) {
  const { mascot } = useAxori();
  // The open chat is client state. Switching chats only rewrites the address bar: a Next navigation would show the
  // route's loading frame and unmount a chat whose first message is still being sent. A new `?t=` from elsewhere
  // (an approvals link) still wins.
  const [currentId, setCurrentId] = useState(initialThread);
  const [seen, setSeen] = useState(initialThread);
  if (seen !== initialThread) {
    setSeen(initialThread);
    setCurrentId(initialThread);
  }
  const [drawer, setDrawer] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const pick = useCallback(
    (id: string | null) => {
      setDrawer(false);
      setCurrentId(id);
      window.history.replaceState(null, "", id ? `/dashboard/ai?t=${id}` : "/dashboard/ai");
    },
    [],
  );
  const { threads, thread, refresh, start, remove, rename } = useThreads(currentId, pick);
  const title = threads?.find((x) => x.id === currentId)?.title ?? a.newChat;

  const list = (
    <ThreadList
      threads={threads}
      current={currentId}
      onPick={pick}
      onNew={() => pick(null)}
      onRemove={(id) => void remove(id)}
      onRename={(id, next) => void rename(id, next)}
      searchRef={searchRef}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 border-t border-panel-3">
      {collapsed ? (
        <aside aria-label={a.history} className="hidden w-[52px] shrink-0 flex-col items-center gap-1 border-r border-panel-3 bg-[#0d0d0d] py-2.5 md:flex">
          <RailButton label={a.expandHistory} onClick={() => setCollapsed(false)}>
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          </RailButton>
          <RailButton label={a.newChat} onClick={() => pick(null)}>
            <span className="grid size-6 place-items-center rounded-md bg-lime text-black">
              <Plus className="size-4" aria-hidden="true" />
            </span>
          </RailButton>
          <RailButton
            label={a.searchChats}
            onClick={() => {
              setCollapsed(false);
              requestAnimationFrame(() => searchRef.current?.focus());
            }}
          >
            <Search className="size-4" aria-hidden="true" />
          </RailButton>
        </aside>
      ) : (
        <aside aria-label={a.history} className="hidden w-[264px] shrink-0 flex-col border-r border-panel-3 bg-[#0d0d0d] px-2.5 pt-2 md:flex">
          <div className="flex h-9 shrink-0 items-center justify-between pr-0.5 pl-2">
            <h2 className="text-[13px] font-medium text-stone">{a.threads}</h2>
            <button type="button" onClick={() => setCollapsed(true)} aria-label={a.collapseHistory} title={a.collapseHistory} className={railButton}>
              <PanelLeftClose className="size-4" aria-hidden="true" />
            </button>
          </div>
          {list}
        </aside>
      )}

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent
          side="left"
          className="w-[86%] max-w-[320px] gap-0 border-panel-3 bg-[#0d0d0d] px-2.5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-cream md:hidden"
        >
          <SheetTitle className="flex h-9 items-center px-2 text-[13px] font-medium text-stone">{a.threads}</SheetTitle>
          {list}
        </SheetContent>
      </Sheet>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-panel-3 px-2 md:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label={a.openHistory}
            className="grid size-10 place-items-center rounded-md text-cream/80 hover:bg-panel-2 hover:text-cream"
          >
            <History className="size-5" aria-hidden="true" />
          </button>
          <p className="min-w-0 flex-1 truncate px-1 text-center text-sm font-medium text-cream">{title}</p>
          <button type="button" onClick={() => pick(null)} aria-label={a.newChat} className="grid size-10 place-items-center rounded-md text-cream/80 hover:bg-panel-2 hover:text-cream">
            <Plus className="size-5" aria-hidden="true" />
          </button>
        </div>
        {thread ? (
          <AxoriChat
            key={thread.id}
            thread={thread}
            storeName={storeName}
            greetingName={greetingName}
            variant="page"
            onTitle={refresh}
            onStart={start}
            initialInput={thread.draft ? initialPrompt : undefined}
          />
        ) : (
          <div className="grid flex-1 place-items-center">
            <Mascot state={mascot === "idle" ? "thinking" : mascot} size={72} />
          </div>
        )}
      </section>
    </div>
  );
}
