"use client";

import { Plus, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t } from "@/lib/messages";
import { MEDIA_ACCEPT, useMediaUpload } from "../../_axori/use-media-upload";
import { removeMedia, saveTags } from "./actions";

const m = t.app.design.media;

export function MediaUpload() {
  const router = useRouter();
  const { state, upload } = useMediaUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const busy = state.status === "uploading";

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        const item = await upload(file, note.trim() || undefined);
        if (item) {
          setFile(null);
          setNote("");
          router.refresh();
        }
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={fileRef}
          id="media-file"
          type="file"
          accept={MEDIA_ACCEPT}
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="max-w-full shrink-0 sm:max-w-56">
          <Upload aria-hidden="true" /> <span className="truncate">{file?.name ?? m.choose}</span>
        </Button>
        <label className="sr-only" htmlFor="media-note">
          {m.note}
        </label>
        <input
          id="media-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder={`${m.note} · ${m.notePlaceholder}`}
          className="h-9 min-w-0 flex-1 rounded-md border border-panel-3 bg-panel-2 px-3 text-sm text-cream outline-none placeholder:text-stone/80 focus-visible:border-lime/50 focus-visible:ring-2 focus-visible:ring-lime/20"
        />
        <Button type="submit" disabled={!file || busy} className="shrink-0">
          {busy ? m.uploading : m.upload}
        </Button>
      </div>
      <p role="status" aria-live="polite" className={`text-sm empty:hidden ${state.status === "error" ? "text-red-300" : "text-lime"}`}>
        {state.status === "error" && state.message}
        {state.status === "done" && m.uploaded.replace("{name}", state.item.name).replace("{tags}", state.item.tags.join(", ") || "—")}
      </p>
    </form>
  );
}

export function TagEditor({ id, tags: initial }: { id: string; tags: string[] }) {
  const [tags, setTags] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (next: string[]) =>
    start(async () => {
      const res = await saveTags(id, next);
      if (res.ok) {
        setTags(res.tags ?? next);
        setError(null);
      } else setError(res.error || m.saveError);
    });

  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-wrap gap-1.5" aria-label={m.tags}>
        {tags.map((tag) => (
          <li key={tag} data-tag={tag} className="inline-flex items-center gap-1 rounded-full bg-panel-3 py-0.5 pr-1 pl-2 text-xs text-cream">
            {tag}
            <button
              type="button"
              disabled={pending}
              onClick={() => save(tags.filter((x) => x !== tag))}
              aria-label={m.removeTag.replace("{tag}", tag)}
              className="grid size-4 place-items-center rounded-full hover:bg-black/30 disabled:opacity-40"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const v = draft.trim();
          if (!v) return;
          setDraft("");
          save([...tags, v]);
        }}
      >
        <label className="sr-only" htmlFor={`tag-${id}`}>
          {m.addTag}
        </label>
        <input
          id={`tag-${id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={32}
          placeholder={m.addTag}
          className="h-8 min-w-0 flex-1 rounded-lg border border-panel-3 bg-panel-2 px-2 text-sm text-cream placeholder:text-stone/70 outline-none focus:border-cream/30"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          aria-label={m.addTag}
          className="grid size-8 place-items-center rounded-lg border border-panel-3 text-cream hover:bg-panel-3 disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function DeleteMedia({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<{ error: string; detail?: string[] } | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`${m.delete} ${name}`}>
        <Trash2 aria-hidden="true" /> {m.delete}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.deleteTitle.replace("{name}", name)}</DialogTitle>
            <DialogDescription>{m.deleteBody}</DialogDescription>
          </DialogHeader>
          {error && (
            <div role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">
              {error.error}
              {error.detail && (
                <ul className="mt-1 list-disc pl-5">
                  {error.detail.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {m.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await removeMedia(id);
                  if (res.ok) {
                    setOpen(false);
                    router.refresh();
                  } else setError(res);
                })
              }
            >
              {m.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
