"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { AxoriChat } from "../../_axori/chat";
import { Mascot } from "../../_axori/mascot";
import { useAxori } from "../../_axori/provider";
import { ThreadList, useThreads } from "../../_axori/threads";

/**
 * Axori AI full page: history on the left, the chat on the right. Opens on a fresh, unsaved chat;
 * earlier chats stay one click away in Recents. Same threads as the side panel.
 */
export function AxoriPage({ initialThread, storeName, greetingName }: { initialThread: string | null; storeName: string; greetingName: string }) {
  const router = useRouter();
  const { mascot } = useAxori();
  const pick = useCallback((id: string | null) => router.replace(id ? `/dashboard/ai?t=${id}` : "/dashboard/ai", { scroll: false }), [router]);
  const { threads, thread, refresh, start, remove, rename } = useThreads(initialThread, pick);

  return (
    <div className="flex min-h-0 flex-1 border-t border-panel-3">
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-panel-3 bg-[#0d0d0d] p-2.5 md:flex">
        <ThreadList threads={threads} current={initialThread} onPick={pick} onNew={() => pick(null)} onRemove={(id) => void remove(id)} onRename={(id, title) => void rename(id, title)} />
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {thread ? (
          <AxoriChat key={thread.id} thread={thread} storeName={storeName} greetingName={greetingName} variant="page" onTitle={refresh} onDraft={(first) => void start(first)} />
        ) : (
          <div className="grid flex-1 place-items-center">
            <Mascot state={mascot === "idle" ? "thinking" : mascot} size={72} />
          </div>
        )}
      </section>
    </div>
  );
}
