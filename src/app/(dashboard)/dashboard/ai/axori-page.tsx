"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { AxoriChat } from "../../_axori/chat";
import { Mascot } from "../../_axori/mascot";
import { useAxori } from "../../_axori/provider";
import { ThreadList, useThreads } from "../../_axori/threads";

/** Axori AI full page: threads on the left, the chat on the right. Same threads as the side panel. */
export function AxoriPage({ initialThread, storeName, greetingName }: { initialThread: string | null; storeName: string; greetingName: string }) {
  const router = useRouter();
  const { mascot } = useAxori();
  const pick = useCallback((id: string) => router.replace(`/dashboard/ai?t=${id}`, { scroll: false }), [router]);
  const { threads, thread, refresh, create, remove } = useThreads(initialThread, pick);

  return (
    <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 sm:px-6 lg:px-8">
      <aside className="hidden w-[280px] shrink-0 flex-col rounded-2xl border border-panel-3 bg-panel p-3 md:flex">
        <ThreadList threads={threads} current={initialThread} onPick={pick} onCreate={(s) => void create(s)} onRemove={(id) => void remove(id)} />
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-panel-3 bg-panel">
        {thread ? (
          <AxoriChat key={thread.id} thread={thread} storeName={storeName} greetingName={greetingName} variant="page" onTitle={refresh} />
        ) : (
          <div className="grid flex-1 place-items-center">
            <Mascot state={mascot === "idle" ? "thinking" : mascot} size={120} />
          </div>
        )}
      </section>
    </div>
  );
}
