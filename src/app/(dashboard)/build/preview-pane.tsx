"use client";

import { ExternalLink, History, Loader2, Monitor, RotateCw, Smartphone, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { t } from "@/lib/messages";
import type { SiteVersion } from "@/modules/storefront";
import { chooseTemplate, restoreSiteVersion, siteVersions, undoDraftEdit } from "./actions";

const SELECT_SECTION_MESSAGE = "axorios:select-section";
const b = t.app.build;

const iconButton =
  "grid size-9 shrink-0 place-items-center rounded-lg text-cream/80 transition hover:bg-panel-3 hover:text-cream disabled:opacity-40";

function VersionHistory({ onRestored, onClose }: { onRestored: () => void; onClose: () => void }) {
  const [versions, setVersions] = useState<SiteVersion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let active = true;
    siteVersions()
      .then((v) => active && setVersions(v))
      .catch(() => active && setVersions([]));
    return () => {
      active = false;
    };
  }, []);

  function restore(id: string) {
    start(async () => {
      const ok = await restoreSiteVersion(id).catch(() => false);
      setFailed(!ok);
      if (ok) {
        onRestored();
        onClose();
      }
    });
  }

  return (
    <div className="absolute top-12 right-0 z-30 w-80 rounded-xl border border-panel-3 bg-panel-2 p-2 shadow-2xl">
      <p className="px-2 py-1.5 text-sm font-medium text-cream">{b.history}</p>
      {!versions ? (
        <Loader2 className="m-3 size-4 animate-spin text-stone" aria-hidden="true" />
      ) : versions.length === 0 ? (
        <p className="px-2 py-2 text-sm text-stone">{b.historyEmpty}</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {versions.map((v, i) => (
            <li key={v.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-panel-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate text-cream" suppressHydrationWarning>
                  {new Date(v.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="text-xs text-stone">
                  {v.status === "published" ? b.publishedVersion : v.createdBy === "agent" ? b.byAgent : b.bySeller} ·{" "}
                  {v.preset.replace("market/", "")}
                </p>
              </div>
              {i === 0 && v.status === "draft" ? (
                <span className="text-xs text-lime">{b.current}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => restore(v.id)}
                  disabled={pending}
                  className="h-8 rounded-md border border-cream/20 px-2.5 text-xs text-cream hover:bg-white/5 disabled:opacity-50"
                >
                  {b.restore}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {failed && <p className="px-2 py-1 text-xs text-red-300">{b.restoreFailed}</p>}
    </div>
  );
}

/**
 * The live draft, shown the way Claude shows an artifact: a panel with its own header that can be closed
 * and reopened from the chat. Clicking a section in the iframe selects it for the next chat message.
 */
export function PreviewPane({
  url,
  version,
  presets,
  publishing,
  onSelectSection,
  onPublish,
  onClose,
}: {
  url: string | null;
  version: number;
  presets: { id: string; label: string }[];
  publishing: boolean;
  onSelectSection: (id: string) => void;
  onPublish: () => void;
  onClose: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [localChanges, setLocalChanges] = useState(0);
  const [nothingToUndo, setNothingToUndo] = useState(false);
  const [renderedPreset, setRenderedPreset] = useState("");
  const [history, setHistory] = useState(false);
  const [pending, startAction] = useTransition();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === SELECT_SECTION_MESSAGE && typeof event.data.id === "string") onSelectSection(event.data.id);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelectSection]);

  const reload = () => setLocalChanges((n) => n + 1);

  function undo() {
    startAction(async () => {
      const reverted = await undoDraftEdit();
      setNothingToUndo(!reverted);
      if (reverted) reload();
    });
  }

  function switchTemplate(presetId: string) {
    setRenderedPreset(presetId);
    startAction(async () => {
      await chooseTemplate(presetId);
      setNothingToUndo(false);
      reload();
    });
  }

  /** The switcher shows what the preview actually rendered, so it can't disagree with the page. */
  function readRenderedPreset() {
    const root = frame.current?.contentDocument?.querySelector<HTMLElement>("[data-preset]");
    setRenderedPreset(root?.dataset.preset ?? "");
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-panel-3 bg-panel">
      <header className="flex items-center gap-1.5 border-b border-panel-3 px-4 py-3">
        <h2 className="mr-auto truncate text-lg font-medium text-cream">{b.previewTitle}</h2>
        {url && (
          <>

            <div className="flex rounded-lg border border-panel-3 p-0.5">
              {(["desktop", "phone"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={d === "desktop" ? t.builder.desktop : t.builder.phone}
                  aria-pressed={device === d}
                  onClick={() => setDevice(d)}
                  className={`grid size-8 place-items-center rounded-md transition ${device === d ? "border border-lime/50 bg-[#2b3118] text-lime" : "text-cream/70 hover:text-cream"}`}
                >
                  {d === "desktop" ? <Monitor className="size-4" aria-hidden="true" /> : <Smartphone className="size-4" aria-hidden="true" />}
                </button>
              ))}
            </div>
            <button type="button" onClick={undo} disabled={pending} aria-label={t.builder.undo} title={t.builder.undo} className={iconButton}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Undo2 className="size-4" aria-hidden="true" />}
            </button>
            <div className="relative">
              <button type="button" onClick={() => setHistory(!history)} aria-expanded={history} aria-label={b.history} title={b.history} className={iconButton}>
                <History className="size-4" aria-hidden="true" />
              </button>
              {history && <VersionHistory onRestored={reload} onClose={() => setHistory(false)} />}
            </div>
            <button type="button" onClick={reload} aria-label={b.reload} title={b.reload} className={iconButton}>
              <RotateCw className="size-4" aria-hidden="true" />
            </button>
            <a href={url} target="_blank" rel="noreferrer" aria-label={b.openTab} title={b.openTab} className={iconButton}>
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={onPublish}
              disabled={publishing}
              className="h-9 rounded-lg bg-lime px-3 text-sm font-semibold text-black transition hover:bg-lime/85 disabled:opacity-50"
            >
              {t.builder.publish}
            </button>
          </>
        )}
        <button type="button" onClick={onClose} aria-label={b.closePreview} title={b.closePreview} className={iconButton}>
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      {url ? (
        <>
          <div className="flex items-center gap-3 border-b border-panel-3 px-4 py-2">
            <select
              value={renderedPreset}
              onChange={(e) => switchTemplate(e.target.value)}
              disabled={pending || !renderedPreset}
              aria-label={t.builder.template}
              className="h-8 shrink-0 rounded-lg border border-panel-3 bg-panel-2 px-2 text-sm text-cream disabled:opacity-50"
            >
              {!renderedPreset && <option value="">{t.builder.template}</option>}
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <p className="min-w-0 truncate text-xs text-stone">{nothingToUndo ? t.builder.nothingToUndo : t.builder.previewHint}</p>
          </div>
          <div className="flex min-h-[320px] flex-1 justify-center overflow-hidden rounded-b-2xl bg-[#0d0d0d] p-2">
            <iframe
              ref={frame}
              key={`${version}-${localChanges}`}
              src={url}
              title={t.builder.previewTitle}
              onLoad={readRenderedPreset}
              className={`h-full rounded-xl bg-white ${device === "phone" ? "w-[390px] max-w-full" : "w-full"}`}
            />
          </div>
        </>
      ) : (
        <p className="flex flex-1 items-center justify-center p-8 text-center text-stone">{b.noPreview}</p>
      )}
    </section>
  );
}
