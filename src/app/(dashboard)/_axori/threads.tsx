"use client";

import { Lightbulb, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { t } from "@/lib/messages";
import type { ThreadSummary } from "@/modules/agent/threads";
import { openThread as readThread, removeThread, startThread, threadList } from "../shell-actions";
import type { ChatThread } from "./chat";

const a = t.app.axori;

/**
 * Loads the thread list and the open thread. With no thread chosen it opens the store's latest chat,
 * or starts one, so Ctrl/⌘+J always lands somewhere to type.
 */
export function useThreads(wanted: string | null, onPick: (id: string) => void, enabled = true) {
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
      if (wanted) {
        const next = await readThread(wanted);
        if (live && next) setThread({ id: next.id, storeId: next.storeId, messages: next.messages });
        return;
      }
      const latest = list.find((x) => x.storeId !== null);
      const id = latest?.id ?? (await startThread("store")).id;
      if (live) onPick(id);
    })();
    return () => {
      live = false;
    };
  }, [wanted, enabled, onPick]);

  const create = useCallback(
    async (scope: "store" | "account") => {
      const { id } = await startThread(scope);
      await refresh();
      onPick(id);
    },
    [refresh, onPick],
  );
  const remove = useCallback(
    async (id: string) => {
      await removeThread(id);
      const list = await refresh();
      if (id === wanted) onPick(list.find((x) => x.storeId !== null)?.id ?? (await startThread("store")).id);
    },
    [refresh, wanted, onPick],
  );

  return { threads, thread: thread && thread.id === wanted ? thread : null, storeId, refresh, create, remove };
}

export function ThreadList({
  threads,
  current,
  onPick,
  onCreate,
  onRemove,
}: {
  threads: ThreadSummary[] | null;
  current: string | null;
  onPick: (id: string) => void;
  onCreate: (scope: "store" | "account") => void;
  onRemove: (id: string) => void;
}) {
  const groups = [
    { label: a.storeThreads, items: (threads ?? []).filter((x) => x.storeId !== null), icon: MessageSquare },
    { label: a.accountThreads, items: (threads ?? []).filter((x) => x.storeId === null), icon: Lightbulb },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onCreate("store")}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-lime text-sm font-semibold text-black transition hover:bg-lime/85"
        >
          <Plus className="size-4" aria-hidden="true" /> {a.newChat}
        </button>
        <button
          type="button"
          onClick={() => onCreate("account")}
          title={a.newIdea}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-panel-3 px-3 text-sm text-cream transition hover:border-cream/30"
        >
          <Lightbulb className="size-4" aria-hidden="true" /> {a.newIdea}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {threads === null && <p className="text-sm text-stone">{a.loading}</p>}
        {groups.map(({ label, items, icon: Icon }) => (
          <section key={label}>
            <h3 className="px-1 text-xs font-medium tracking-wider text-stone uppercase">{label}</h3>
            {items.length === 0 && threads !== null && <p className="px-1 pt-1.5 text-sm text-stone/70">{a.noThreads}</p>}
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {items.map((thread) => (
                <li key={thread.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onPick(thread.id)}
                    aria-current={thread.id === current ? "true" : undefined}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 pr-9 text-left text-sm transition ${
                      thread.id === current ? "bg-panel-3 text-cream" : "text-cream/75 hover:bg-panel-2 hover:text-cream"
                    }`}
                  >
                    <Icon className="size-4 shrink-0 text-stone" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                    {thread.waiting > 0 && <span className="rounded-full bg-lime px-1.5 text-xs font-semibold text-black">{thread.waiting}</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(thread.id)}
                    aria-label={`${a.deleteThread}: ${thread.title}`}
                    className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-stone opacity-0 transition group-hover:opacity-100 hover:text-red-300 focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
