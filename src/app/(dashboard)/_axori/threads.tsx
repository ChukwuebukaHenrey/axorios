"use client";

import { MoreHorizontal, Pencil, SquarePen, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { t } from "@/lib/messages";
import type { ThreadSummary } from "@/modules/agent/threads";
import { openThread as readThread, removeThread, retitleThread, startThread, threadList } from "../shell-actions";
import { DRAFT, handOff, type ChatThread, type Handoff } from "./chat";

const a = t.app.axori;

/**
 * Loads the thread list and the open thread. With no thread chosen it shows an empty draft;
 * the thread row is only created when the seller first sends, speaks or attaches something.
 */
export function useThreads(wanted: string | null, onPick: (id: string | null) => void, enabled = true) {
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

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
      if (!wanted) return;
      const next = await readThread(wanted);
      if (live && next) setThread({ id: next.id, storeId: next.storeId, messages: next.messages });
    })();
    return () => {
      live = false;
    };
  }, [wanted, enabled]);

  /** The draft's first message: create the thread, hand the message over, then switch to it. */
  const start = useCallback(
    async (first: Handoff) => {
      const { id } = await startThread("store");
      handOff(id, first);
      onPick(id);
      void refresh();
    },
    [onPick, refresh],
  );
  const remove = useCallback(
    async (id: string) => {
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

  const draft: ChatThread = { id: DRAFT, storeId: storeId ?? "", messages: [] };
  const current = wanted ? (thread && thread.id === wanted ? thread : null) : draft;
  return { threads, thread: current, storeId, refresh, start, remove, rename };
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
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(thread.title);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const save = () => {
    setEditing(false);
    const clean = value.trim();
    if (clean && clean !== thread.title) onRename(thread.id, clean);
    else setValue(thread.title);
  };

  if (editing) {
    return (
      <li>
        <input
          ref={inputRef}
          value={value}
          aria-label={a.renameThread}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(thread.title);
              setEditing(false);
            }
          }}
          className="h-8 w-full rounded-md border border-lime/40 bg-panel-2 px-2.5 text-sm text-cream outline-none"
        />
      </li>
    );
  }

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onPick(thread.id)}
        aria-current={on ? "true" : undefined}
        className={`flex h-8 w-full items-center gap-2 rounded-md px-2.5 pr-8 text-left text-[13px] transition-colors ${
          on ? "bg-panel-3 text-cream" : "text-cream/70 hover:bg-panel-2 hover:text-cream"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{thread.title}</span>
        {thread.waiting > 0 && <span className="rounded bg-lime px-1 text-[11px] font-semibold text-black">{thread.waiting}</span>}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={a.chatActions.replace("{title}", thread.title)}
          className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded text-stone opacity-0 transition group-hover:opacity-100 hover:bg-panel-3 hover:text-cream focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil aria-hidden="true" /> {a.renameThread}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onRemove(thread.id)}>
            <Trash2 aria-hidden="true" /> {a.deleteThread}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function ThreadList({
  threads,
  current,
  onPick,
  onNew,
  onRemove,
  onRename,
}: {
  threads: ThreadSummary[] | null;
  current: string | null;
  onPick: (id: string) => void;
  onNew: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <button
        type="button"
        onClick={onNew}
        aria-current={current === null ? "true" : undefined}
        className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-cream transition-colors hover:bg-panel-2 aria-[current]:bg-panel-2"
      >
        <span className="grid size-6 place-items-center rounded-md bg-lime text-black">
          <SquarePen className="size-3.5" aria-hidden="true" />
        </span>
        {a.newChat}
      </button>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <h3 className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wider text-stone uppercase">{a.recents}</h3>
        {threads === null && <p className="px-2.5 text-sm text-stone">{a.loading}</p>}
        {threads?.length === 0 && <p className="px-2.5 text-sm text-stone/70">{a.noThreads}</p>}
        <ul className="flex flex-col gap-px">
          {threads?.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} on={thread.id === current} onPick={onPick} onRemove={onRemove} onRename={onRename} />
          ))}
        </ul>
      </div>
    </div>
  );
}
