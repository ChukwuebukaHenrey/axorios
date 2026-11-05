"use client";

import { Loader2, Monitor, Smartphone, Undo2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { t } from "@/lib/messages";
import { chooseTemplate, undoDraftEdit } from "./actions";

const SELECT_SECTION_MESSAGE = "axorios:select-section";

export function PreviewPane({
  url,
  version,
  presets,
  publishing,
  onSelectSection,
  onPublish,
}: {
  url: string | null;
  version: number;
  presets: { id: string; label: string }[];
  publishing: boolean;
  onSelectSection: (id: string) => void;
  onPublish: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [localChanges, setLocalChanges] = useState(0);
  const [nothingToUndo, setNothingToUndo] = useState(false);
  const [renderedPreset, setRenderedPreset] = useState("");
  const [pending, startAction] = useTransition();

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
    startAction(async () => {
      const reverted = await undoDraftEdit();
      setNothingToUndo(!reverted);
      if (reverted) setLocalChanges((n) => n + 1);
    });
  }

  function switchTemplate(presetId: string) {
    setRenderedPreset(presetId);
    startAction(async () => {
      await chooseTemplate(presetId);
      setNothingToUndo(false);
      setLocalChanges((n) => n + 1);
    });
  }

  /** The switcher shows what the preview actually rendered, so it can't disagree with the page. */
  function readRenderedPreset() {
    const root = frame.current?.contentDocument?.querySelector<HTMLElement>("[data-preset]");
    setRenderedPreset(root?.dataset.preset ?? "");
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
        <select
          value={renderedPreset}
          onChange={(e) => switchTemplate(e.target.value)}
          disabled={pending || !renderedPreset}
          aria-label={t.builder.template}
          className="h-10 min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-2 text-sm font-medium disabled:opacity-50 sm:max-w-44"
        >
          {!renderedPreset && <option value="">{t.builder.template}</option>}
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <p className="hidden min-w-0 flex-1 truncate text-sm text-black/60 xl:block">
          {nothingToUndo ? t.builder.nothingToUndo : t.builder.previewHint}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={pending}
            aria-label={t.builder.undo}
            className="flex h-10 items-center gap-2 rounded-lg border border-black/15 px-3 text-sm font-medium transition hover:bg-black/5 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Undo2 className="size-4" aria-hidden="true" />}
            <span className="hidden sm:inline">{t.builder.undo}</span>
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="h-10 rounded-lg bg-secondary px-3 text-sm font-semibold text-ink transition hover:bg-accent disabled:opacity-50"
          >
            {t.builder.publish}
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-black/5">
        <iframe
          ref={frame}
          key={`${version}-${localChanges}`}
          src={url}
          title={t.builder.previewTitle}
          onLoad={readRenderedPreset}
          className={`h-full bg-white ${device === "phone" ? "w-[390px] max-w-full shadow-lg" : "w-full"}`}
        />
      </div>
    </div>
  );
}
