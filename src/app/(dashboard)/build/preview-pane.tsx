"use client";

import { Loader2, Monitor, Smartphone, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { t } from "@/lib/messages";
import { undoDraftEdit } from "./actions";

const SELECT_SECTION_MESSAGE = "axorios:select-section";

export function PreviewPane({
  url,
  version,
  onSelectSection,
}: {
  url: string | null;
  version: number;
  onSelectSection: (id: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [undoCount, setUndoCount] = useState(0);
  const [nothingToUndo, setNothingToUndo] = useState(false);
  const [undoing, startUndo] = useTransition();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === SELECT_SECTION_MESSAGE && typeof event.data.id === "string") {
        onSelectSection(event.data.id);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelectSection]);

  if (!url) return <p className="p-6 text-black/60">{t.builder.panelEmpty}</p>;

  function undo() {
    startUndo(async () => {
      const reverted = await undoDraftEdit();
      setNothingToUndo(!reverted);
      if (reverted) setUndoCount((n) => n + 1);
    });
  }

  const toggle = (active: boolean) =>
    `grid size-10 place-items-center rounded-lg transition ${active ? "bg-primary text-white" : "hover:bg-black/5"}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-black/10 bg-white px-3 py-2">
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={t.builder.desktop}
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
            className={toggle(device === "desktop")}
          >
            <Monitor className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t.builder.phone}
            aria-pressed={device === "phone"}
            onClick={() => setDevice("phone")}
            className={toggle(device === "phone")}
          >
            <Smartphone className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p className="hidden min-w-0 truncate text-sm text-black/60 lg:block">
          {nothingToUndo ? t.builder.nothingToUndo : t.builder.previewHint}
        </p>
        <button
          type="button"
          onClick={undo}
          disabled={undoing}
          className="flex h-10 items-center gap-2 rounded-lg border border-black/15 px-3 text-sm font-medium transition hover:bg-black/5 disabled:opacity-50"
        >
          {undoing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Undo2 className="size-4" aria-hidden="true" />}
          {t.builder.undo}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-black/5">
        <iframe
          ref={frame}
          key={`${version}-${undoCount}`}
          src={url}
          title={t.builder.previewTitle}
          className={`h-full bg-white ${device === "phone" ? "w-[390px] max-w-full shadow-lg" : "w-full"}`}
        />
      </div>
    </div>
  );
}
