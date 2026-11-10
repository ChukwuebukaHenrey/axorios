"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ImagePlus, Loader2, RefreshCw, X } from "lucide-react";
import {
  PHOTO_SHORTCUTS, PHOTO_SHORTCUT_LABELS, parsePhotoShortcut,
  type ParsedPhotoShortcut, type PhotoShortcut,
} from "@/lib/product-photo-shortcuts";

type Props = { initial: ParsedPhotoShortcut; onClose: () => void };
const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;

export function ProductPhotoStudio({ initial, onClose }: Props) {
  const [shortcut, setShortcut] = useState<PhotoShortcut>(initial.shortcut);
  const [details, setDetails] = useState(initial.details);
  const [photo, setPhoto] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);

  // Only images the user selects in THIS studio session are references.
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => () => { if (generatedUrl) URL.revokeObjectURL(generatedUrl); }, [generatedUrl]);

  function choose(file?: File) {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose an original JPG, PNG, or WebP photograph.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("The original photo must be 4 MB or smaller.");
      return;
    }
    setPhoto(file);
    setGeneratedUrl(null);
  }
  async function generate() {
    if (!photo) return setError("Upload your original product photo first. Generated images and mockups are not suitable references.");
    if (shortcut === "/seasonal" && !details.trim()) return setError("Choose a season.");
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("photo", photo);
    form.set("command", `${shortcut}${details.trim() ? ` ${details.trim()}` : ""}`);
    try {
      const response = await fetch("/api/product-photo", { method: "POST", body: form });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(failure.message || "Couldn't generate the image.");
      }
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("The server returned an invalid image.");
      setGeneratedUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate the image.");
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!generatedUrl) return;
    const a = document.createElement("a");
    a.href = generatedUrl;
    a.download = `product-${shortcut.slice(1)}.png`;
    a.click();
  }
  const prompt = parsePhotoShortcut(`${shortcut} ${details}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#0d0d0d] text-cream" aria-label="Product photo studio">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-panel-3 bg-[#0d0d0d] px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Product photo studio</h2>
          <p className="text-xs text-stone">One original photo · one square image</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close studio" className="grid size-9 place-items-center rounded-lg hover:bg-panel-2"><X className="size-5" /></button>
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-5 pb-24">
        <div>
          <p className="mb-2 text-xs font-medium text-stone">Choose a photo style</p>
          <div className="flex flex-wrap gap-2">
            {PHOTO_SHORTCUTS.map((s) => (
              <button key={s} type="button" aria-pressed={shortcut === s}
                onClick={() => { setShortcut(s); setDetails(""); setError(""); setGeneratedUrl(null); }}
                className={`min-h-10 rounded-full border px-3 text-sm transition-colors ${shortcut === s ? "border-lime bg-lime text-black" : "border-panel-3 bg-panel-2 text-cream hover:border-stone"}`}>
                {PHOTO_SHORTCUT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        {shortcut === "/seasonal" && (
          <div>
            <p className="mb-2 text-xs font-medium text-stone">Which season?</p>
            <div className="grid grid-cols-4 gap-2">
              {SEASONS.map((s) => (
                <button type="button" key={s} onClick={() => setDetails(s)} aria-pressed={details.toLowerCase() === s.toLowerCase()}
                  className={`min-h-10 rounded-lg border px-1 text-xs ${details.toLowerCase() === s.toLowerCase() ? "border-lime bg-lime/15 text-lime" : "border-panel-3 text-cream"}`}>{s}</button>
              ))}
            </div>
          </div>
        )}
        <label className="block">
          <span className="mb-2 block text-xs font-medium text-stone">Extra scene instructions (optional)</span>
          <input value={details} maxLength={350} onChange={(e) => setDetails(e.target.value)}
            placeholder={shortcut === "/seasonal" ? "e.g. Winter, snowy cafe setting" : "e.g. natural window light, wooden table"}
            className="h-11 w-full rounded-lg border border-panel-3 bg-panel-2 px-3 text-sm text-cream outline-none focus:border-lime/60" />
        </label>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-stone">Original product photograph</p>
            {photo && <button type="button" onClick={() => picker.current?.click()} className="text-xs text-lime">Replace photo</button>}
          </div>
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
            onChange={(e) => { choose(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} />
          <button type="button" onClick={() => picker.current?.click()}
            className="flex aspect-square w-full max-w-sm flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-panel-3 bg-panel-2 text-stone transition-colors hover:border-lime/60">
            {originalUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={originalUrl} alt="Your original uploaded product photo" className="h-full w-full object-contain" />
            ) : (
              <><ImagePlus className="mb-2 size-8" /><span className="text-sm">Tap to upload your original photo</span><span className="mt-1 text-xs">JPG, PNG or WebP · maximum 4 MB</span></>
            )}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-stone">
            Use an original photograph of the actual product. Do not upload generated images or screenshots.
            The AI is instructed to preserve the product and change only its setting; inspect fine details before publishing.
          </p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}
        <button type="button" onClick={() => void generate()} disabled={busy || !photo || !prompt || (shortcut === "/seasonal" && !details.trim())}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-lime px-4 font-semibold text-black disabled:opacity-40">
          {busy ? <><Loader2 className="size-4 animate-spin" /> Generating…</> : generatedUrl ? <><RefreshCw className="size-4" /> Regenerate image</> : "Generate one square image"}
        </button>
        {generatedUrl && (
          <div className="space-y-3" aria-live="polite">
            <h3 className="text-sm font-semibold">Your result · 1024 × 1024</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={generatedUrl} alt="AI-generated square product photo" className="aspect-square w-full max-w-sm rounded-xl object-contain" />
            <button type="button" onClick={download} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-lime/50 bg-panel-2 text-sm font-semibold text-lime">
              <ArrowDownToLine className="size-4" /> Download PNG
            </button>
            <p className="text-xs text-stone">Check the logo, exact wording, proportions and physical details against your original. AI editing cannot guarantee perfect preservation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
