"use client";

import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { t } from "@/lib/messages";
import type { ThreadSummary } from "@/modules/agent/threads";
import { openThread as readThread, removeThread, retitleThread, threadList } from "../shell-actions";
import type { ChatThread } from "./chat";

const a = t.app.axori;

/**
 * Loads the thread list and the open thread. With no thread chosen it shows an unsaved draft with its own id.
 * Nothing is written until the seller sends, or speaks, a first message: the agent route then creates the row
 * with that message (attaching a file alone keeps the chat a draft). The draft then becomes the open thread in
 * place, so the stream that is under way keeps running.
 */
export function useThreads(wanted: string | null, onPick: (id: string | null) => void, enabled = true) {
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState(newDraftId);

  const refresh = useCallback(async () => {
    const list = await threadList();
    setThreads(list);
    return list;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    (async () => {
      const list = await threadList();
      if (!live) return;
      setThreads(list);
      const store = list.find((x) => x.storeId !== null);
      if (store) setStoreId(store.storeId);
      // A draft that just became this thread is already on screen with its live chat; don't reload it.
      if (!wanted || thread?.id === wanted) return;
      const next = await readThread(wanted);
      if (!live) return;
      // A deleted or unknown thread (an old link) opens a new chat rather than waiting forever.
      if (next) setThread({ id: next.id, storeId: next.storeId, messages: next.messages });
      else onPick(null);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, enabled]);

  /** The draft's first message went out: it is now a real thread. The next New chat gets a fresh id. */
  const start = useCallback(
    (id: string, scopeStoreId: string | null) => {
      setThread({ id, storeId: scopeStoreId, messages: [], fresh: true });
      setDraftId(newDraftId());
      onPick(id);
    },
    [onPick],
  );
  const remove = useCallback(
    async (id: string) => {
      setThreads((list) => list?.filter((x) => x.id !== id) ?? list);
      await removeThread(id);
      await refresh();
      if (id === wanted) onPick(null);
    },
    [refresh, wanted, onPick],
  );
  const rename = useCallback(
    async (id: string, title: string) => {
      setThreads((list) => list?.map((x) => (x.id === id ? { ...x, title } : x)) ?? list);
      await retitleThread(id, title);
      void refresh();
    },
    [refresh],
  );

  const draft: ChatThread = { id: draftId, storeId: storeId ?? "", messages: [], fresh: true, draft: true };
  const current = wanted ? (thread && thread.id === wanted ? thread : null) : draft;
  return { threads, thread: current, storeId, refresh, start, remove, rename };
}

const newDraftId = () => crypto.randomUUID();

/** History sections by last activity, in the seller's own time zone. */
type GroupKey = keyof typeof a.groups;
function groupOf(updatedAt: string, now: Date): GroupKey {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const at = new Date(updatedAt).getTime();
  if (at >= startOfToday) return "today";
  if (at >= startOfToday - 86_400_000) return "yesterday";
  if (at >= startOfToday - 7 * 86_400_000) return "week";
  return "older";
}

function ThreadRow({
  thread,
  on,
  onPick,
  onRemove,
  onRename,
}: {
  thread: ThreadSummary;
  on: boolean;
  onPick: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const [value, setValue] = useState(thread.title);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mode === "rename") inputRef.current?.select();
  }, [mode]);

  const save = () => {
    setMode("view");
    const clean = value.trim();
    if (clean && clean !== thread.title) onRename(thread.id, clean);
    else setValue(thread.title);
  };

  if (mode === "rename") {
    return (
      <li className="px-0.5 py-px">
        <input
          ref={inputRef}
          value={value}
          aria-label={a.renameThread}
          maxLength={80}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(thread.title);
              setMode("view");
            }
          }}
          className="h-8 w-full rounded-md border border-lime/40 bg-panel-2 px-2.5 text-[13px] text-cream outline-none"
        />
      </li>
    );
  }

  if (mode === "delete") {
    return (
      <li role="alertdialog" aria-label={a.deleteConfirm} className="my-0.5 rounded-md border border-red-500/30 bg-red-500/[0.06] px-2.5 py-2">
        <p className="truncate text-[13px] text-cream">{a.deleteConfirm}</p>
        <p className="truncate text-xs text-stone">{thread.title}</p>
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            autoFocus
            onClick={() => onRemove(thread.id)}
            className="h-7 rounded-md bg-red-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
          >
            {a.deleteYes}
          </button>
          <button type="button" onClick={() => setMode("view")} className="h-7 rounded-md px-2.5 text-xs text-cream/80 transition-colors hover:bg-panel-3 hover:text-cream">
            {a.cancel}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="group/row relative">
      <button
        type="button"
        onClick={() => onPick(thread.id)}
        aria-current={on ? "page" : undefined}
        className={`relative flex h-8 w-full items-center gap-2 rounded-md pr-8 pl-2.5 text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-lime/50 ${
          on ? "bg-panel-2 font-medium text-cream" : "text-cream/70 hover:bg-panel-2/60 hover:text-cream"
        }`}
      >
        {on && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-lime" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate">{thread.title}</span>
        {thread.storeId === null && <span className="shrink-0 rounded border border-panel-3 px-1 text-[10px] text-stone">{a.ideaTag}</span>}
        {thread.waiting > 0 && <span className="shrink-0 rounded bg-lime px-1 text-[11px] font-semibold text-black tabular-nums">{thread.waiting}</span>}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={a.chatActions.replace("{title}", thread.title)}
          className={`absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded text-stone transition hover:bg-panel-3 hover:text-cream focus-visible:opacity-100 data-[state=open]:bg-panel-3 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100 ${
            on ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"
          }`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => setMode("rename")}>
            <Pencil aria-hidden="true" /> {a.renameThread}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setMode("delete")}>
            <Trash2 aria-hidden="true" /> {a.deleteThread}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/**
 * Chat history: New chat on top, a search box, then chats grouped by last activity. The list scrolls on its own
 * so New chat and search stay in reach. Used by the full page's sidebar, its phone drawer and the side panel.
 */
export function ThreadList({
  threads,
  current,
  onPick,
  onNew,
  onRemove,
  onRename,
  searchRef,
}: {
  threads: ThreadSummary[] | null;
  current: string | null;
  onPick: (id: string) => void;
  onNew: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, title: string) => void;
  searchRef?: Ref<HTMLInputElement>;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const groups = useMemo(() => {
    const now = new Date();
    const found = (threads ?? []).filter((x) => !query || x.title.toLowerCase().includes(query));
    const order: GroupKey[] = ["today", "yesterday", "week", "older"];
    return order.map((key) => ({ key, items: found.filter((x) => groupOf(x.updatedAt, now) === key) })).filter((g) => g.items.length > 0);
  }, [threads, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-1 pb-2">
        <button
          type="button"
          onClick={onNew}
          aria-current={current === null ? "page" : undefined}
          className="flex h-9 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-cream transition-colors outline-none hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-lime/50 aria-[current]:bg-panel-2"
        >
          <span className="grid size-6 place-items-center rounded-md bg-lime text-black">
            <Plus className="size-4" aria-hidden="true" />
          </span>
          {a.newChat}
        </button>
        <label className="flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-stone transition-colors focus-within:bg-panel-2 hover:bg-panel-2/60">
          <Search className="ml-1 size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">{a.searchChats}</span>
          <input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Inside the side panel's menu, keys belong to this box, not the menu's type-ahead.
              e.stopPropagation();
              if (e.key === "Escape") setQ("");
            }}
            placeholder={a.searchChats}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-cream outline-none placeholder:text-stone [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
      </div>
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="pr-2 pb-3">
          {threads === null && <p className="px-2.5 py-1 text-[13px] text-stone">{a.loading}</p>}
          {threads?.length === 0 && <p className="px-2.5 py-1 text-[13px] text-stone/80">{a.noThreads}</p>}
          {threads && threads.length > 0 && groups.length === 0 && (
            <p className="px-2.5 py-1 text-[13px] text-stone/80 [overflow-wrap:anywhere]">{a.noMatches.replace("{q}", q.trim())}</p>
          )}
          {groups.map((g) => (
            <section key={g.key} aria-label={a.groups[g.key]} className="pt-2 first:pt-0">
              <h3 className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-stone/80">{a.groups[g.key]}</h3>
              <ul className="flex flex-col gap-px">
                {g.items.map((thread) => (
                  <ThreadRow key={thread.id} thread={thread} on={thread.id === current} onPick={onPick} onRemove={onRemove} onRename={onRename} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
