"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { PHOTO_SHORTCUTS, parsePhotoShortcut } from "@/modules/creative/photo-shortcuts";
import { useMediaUpload, type UploadedMedia } from "./use-media-upload";

const codes = PHOTO_SHORTCUTS;

type Result = { url: string; command: string };

/** Mobile-friendly original-photo editor, separate from ordinary agent messages. */
export function ProductPhotoStudio({ threadId }: { threadId: string }) {
  const [open, setOpen] = useState(false);
  const [original, setOriginal] = useState<UploadedMedia | null>(null);
  const [command, setCommand] = useState("/whitebg");
  const [result, setResult] = useState<Result | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const resultUrl = useRef<string | null>(null);
  const media = useMediaUpload(threadId === "draft" ? undefined : threadId);

  useEffect(() => () => {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
  }, []);

  const selectFile = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Upload an original JPG, PNG or WebP product photo.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Photo must be under 4 MB.");
      return;
    }
    const uploaded = await media.upload(file, "Original product photograph");
    if (!uploaded) return;
    setOriginal(uploaded);
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = null;
    setResult(null);
  };

  const generate = async () => {
    if (!original || generating || media.state.status === "uploading") return;
    if (!parsePhotoShortcut(command)) {
      setError("Start with one of the five photo shortcuts.");
      return;
    }
    if (command.trim().toLowerCase() === "/seasonal") {
      setError("Name a season, for example /seasonal winter.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/product-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: original.id, command: command.trim() }),
      });
      if (!response.ok) {
        const details = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(details.message || "Could not generate the photo.");
      }
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("The service did not return an image.");
      const url = URL.createObjectURL(blob);
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      resultUrl.current = url;
      setResult({ url, command: command.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="w-full" aria-label="Product photo studio">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-lime/35 bg-[#1d2313] px-3 text-sm font-medium text-lime transition hover:border-lime/70"
      >
        <Sparkles className="size-4" aria-hidden="true" /> Product photo studio
        {open ? <X className="ml-1 size-4" aria-hidden="true" /> : <ImagePlus className="ml-1 size-4" aria-hidden="true" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-2xl border border-panel-3 bg-[#171817] p-3 sm:p-4">
          <div>
            <h3 className="text-base font-semibold text-cream">Create product images</h3>
            <p className="mt-1 text-xs leading-relaxed text-stone">
              Upload your original product photograph. The product is the reference, never a previous AI result.
            </p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => { void selectFile(e.target.files?.[0]); e.target.value = ""; }}
          />
          <button
            type="button"
            disabled={generating || media.state.status === "uploading"}
            onClick={() => fileRef.current?.click()}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-dashed border-cream/25 bg-panel-2 px-3 text-left text-sm text-cream hover:border-lime/50 disabled:opacity-50"
          >
            {original ? (
              // Image comes from the authenticated owner's own media-library upload.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={original.url} alt="Original product reference" className="size-12 shrink-0 rounded-lg bg-white object-contain" />
            ) : <ImagePlus className="size-6 shrink-0 text-lime" aria-hidden="true" />}
            <span className="min-w-0">
              <span className="block truncate font-medium">{original?.name ?? "Upload original photo"}</span>
              <span className="block text-xs text-stone">{original ? "Tap to replace the original source photo" : "JPG, PNG, WebP · 4 MB maximum"}</span>
            </span>
          </button>

          <div className="flex flex-wrap gap-2" aria-label="Photography shortcuts">
            {codes.map((shortcut) => {
              const selected = command.toLowerCase().startsWith(shortcut.code);
              return (
                <button
                  key={shortcut.code}
                  type="button"
                  onClick={() => { setCommand(shortcut.code === "/seasonal" ? "/seasonal " : shortcut.code); setError(""); }}
                  title={shortcut.description}
                  aria-pressed={selected}
                  className={`min-h-10 rounded-full border px-3 text-xs font-medium transition ${selected ? "border-lime bg-lime text-black" : "border-cream/20 text-cream hover:border-lime/40"}`}
                >
                  {shortcut.code}
                </button>
              );
            })}
          </div>

          <label className="block text-xs font-medium text-cream" htmlFor="product-photo-command">
            Shortcut and scene instructions
          </label>
          <textarea
            id="product-photo-command"
            rows={2}
            maxLength={550}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="/seasonal winter, on a wooden table"
            className="w-full resize-y rounded-xl border border-panel-3 bg-panel-2 px-3 py-2.5 text-sm text-cream outline-none placeholder:text-stone focus:border-lime"
          />
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!original || generating || media.state.status === "uploading"}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-lime px-4 text-sm font-semibold text-black transition hover:bg-lime/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating ? <><LoaderCircle className="size-4 animate-spin" /> Generating…</> : <><Sparkles className="size-4" /> Generate square image</>}
          </button>
          {media.state.status === "uploading" && <p role="status" className="text-xs text-stone">Uploading your original photo…</p>}
          {media.state.status === "error" && <p role="alert" className="text-xs text-red-300">{media.state.message}</p>}
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          {result && (
            <div className="space-y-3 border-t border-panel-3 pt-3">
              <p className="text-sm font-medium text-cream">Your generated image</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.url} alt="AI-generated product photograph" className="mx-auto aspect-square w-full max-w-sm rounded-xl bg-white object-contain" />
              <p className="text-xs leading-relaxed text-stone">
                Review the result against the original: AI image editing may alter labels, proportions or details.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={result.url}
                  download="product-photo.png"
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-lime px-3 text-sm font-semibold text-black"
                >
                  <Download className="size-4" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={generating}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-panel-3 px-3 text-sm text-cream disabled:opacity-50"
                >
                  <RefreshCw className="size-4" /> Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
