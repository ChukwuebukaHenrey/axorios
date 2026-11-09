"use client";

import { ChevronDown, Maximize2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { t } from "@/lib/messages";
import { AxoriChat } from "./chat";
import { Mascot } from "./mascot";
import { useAxori } from "./provider";
import { ThreadList, useThreads } from "./threads";

const a = t.app.axori;

/** Axori AI over the current page (Ctrl/⌘+J). Full screen on phones. The full page at /dashboard/ai shares its threads. */
export function AxoriPanel({ storeName, greetingName }: { storeName: string; greetingName: string }) {
  const { open, setOpen, threadId, openThread, mascot } = useAxori();
  const pathname = usePathname();
  const router = useRouter();
  const onPage = pathname.startsWith("/dashboard/ai");
  const show = open && !onPage;
  const { threads, thread, refresh, create, remove } = useThreads(threadId, openThread, show);
  const [menu, setMenu] = useState(false);
  const title = threads?.find((x) => x.id === threadId)?.title ?? a.title;

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          key="axori-panel"
          role="dialog"
          aria-label={a.title}
          initial={{ x: "100%", opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.6 }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="fixed inset-0 z-50 flex flex-col border-l border-panel-3 bg-[#111211] font-display text-cream shadow-2xl shadow-black/60 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[460px]"
        >
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-panel-3 px-3">
            <Mascot state={mascot} size={40} />
            <DropdownMenu open={menu} onOpenChange={setMenu}>
              <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-left hover:bg-panel-2">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-cream">{a.title}</span>
                  <span className="block truncate text-xs text-stone">{title}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-stone" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="flex h-[420px] w-[340px] flex-col p-3">
                <ThreadList
                  threads={threads}
                  current={threadId}
                  onPick={(id) => {
                    openThread(id);
                    setMenu(false);
                  }}
                  onCreate={(scope) => {
                    void create(scope);
                    setMenu(false);
                  }}
                  onRemove={(id) => void remove(id)}
                />
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(threadId ? `/dashboard/ai?t=${threadId}` : "/dashboard/ai");
              }}
              aria-label={a.expand}
              title={a.expand}
              className="grid size-9 place-items-center rounded-lg text-stone hover:bg-panel-2 hover:text-cream"
            >
              <Maximize2 className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={a.close}
              title={`${a.close} (Esc)`}
              className="grid size-9 place-items-center rounded-lg text-stone hover:bg-panel-2 hover:text-cream"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          {thread ? (
            <AxoriChat key={thread.id} thread={thread} storeName={storeName} greetingName={greetingName} variant="panel" onTitle={refresh} />
          ) : (
            <div className="grid flex-1 place-items-center">
              <Mascot state="thinking" size={72} />
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
