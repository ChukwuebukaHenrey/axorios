"use client";

import { CalendarClock, Download, ExternalLink, ImageIcon, Loader2, Pencil } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { t } from "@/lib/messages";
import { cn } from "@/lib/utils";
import type { Post } from "@/modules/creative";
import { approveAndSchedule, cancelSchedule, saveCaption } from "./actions";

const c = t.campaigns;
const showTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** The value a datetime-local input wants: the seller's own clock, with no timezone. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultTime(post: Post): string {
  const suggested = post.scheduled_at ?? post.suggested_at;
  const inAnHour = new Date(Date.now() + 60 * 60 * 1000);
  return toLocalInput(suggested && new Date(suggested) > new Date() ? new Date(suggested) : inAnHour);
}

function publishedUrl(post: Post): string | null {
  for (const result of Object.values(post.publish_results as Record<string, unknown>)) {
    const url = (result as { url?: unknown } | null)?.url;
    if (typeof url === "string") return url;
  }
  return null;
}

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: c.statusDraft, tone: "bg-panel/90 text-cream/90" },
  scheduled: { label: c.statusScheduled, tone: "bg-sky-500/20 text-sky-200" },
  published: { label: c.statusPublished, tone: "bg-lime/20 text-lime" },
  failed: { label: c.statusFailed, tone: "bg-red-500/20 text-red-200" },
};

const btn = "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors disabled:opacity-50";
const btnQuiet = cn(btn, "border border-panel-3 bg-panel-2 text-cream hover:bg-panel-3");
const btnMain = cn(btn, "bg-lime text-black hover:bg-lime/85");
const field = "w-full rounded-md border border-panel-3 bg-panel-2 px-3 text-sm text-cream outline-none focus-visible:border-lime/50 focus-visible:ring-2 focus-visible:ring-lime/20 [color-scheme:dark]";

export function PostCard({ post, canPublish }: { post: Post; canPublish: boolean }) {
  const [caption, setCaption] = useState(post.caption);
  const [time, setTime] = useState(() => defaultTime(post));
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (post.status === "generating") {
    return (
      <article className="flex h-full flex-col overflow-hidden rounded-xl border border-panel-3 bg-panel">
        <div className="grid aspect-square animate-pulse place-items-center bg-panel-2">
          <Loader2 className="size-5 animate-spin text-stone" aria-hidden="true" />
        </div>
        <p className="p-4 text-sm text-stone">{c.generating}</p>
      </article>
    );
  }

  const editable = post.status === "draft" || post.status === "failed" || post.status === "scheduled";
  const canSchedule = editable && canPublish && post.status !== "scheduled";
  const url = publishedUrl(post);
  const status = STATUS[post.status];

  function save() {
    startTransition(async () => {
      const result = await saveCaption(post.id, caption);
      setNotice(result.ok ? c.saved : c.errorGeneric);
    });
  }

  function schedule() {
    startTransition(async () => {
      const at = new Date(time);
      if (Number.isNaN(at.getTime())) return setNotice(c.errorTime);
      const saved = caption === post.caption ? { ok: true as const } : await saveCaption(post.id, caption);
      if (!saved.ok) return setNotice(c.errorGeneric);
      const result = await approveAndSchedule(post.id, at.toISOString());
      if (result.ok) return setNotice(null);
      setNotice(result.error === "time_in_past" || result.error === "time_too_far" ? c.errorTime : c.errorGeneric);
    });
  }

  const when =
    post.status === "scheduled" && post.scheduled_at
      ? c.scheduledFor.replace("{time}", showTime(post.scheduled_at))
      : post.status === "published"
        ? c.published.replace("{time}", post.scheduled_at ? showTime(post.scheduled_at) : "")
        : null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-panel-3 bg-panel transition-colors hover:border-cream/15">
      <div className="relative aspect-square bg-panel-2">
        {post.media_url ? (
          <Image src={post.media_url} alt={c.imageAlt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-stone">
            <ImageIcon className="size-6" aria-hidden="true" />
          </span>
        )}
        {status && (
          <span className={cn("absolute top-3 left-3 rounded-md px-2 py-0.5 text-xs font-medium backdrop-blur", status.tone)}>{status.label}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {when && (
          <p className="flex items-center gap-1.5 text-xs text-stone" suppressHydrationWarning>
            <CalendarClock className="size-3.5" aria-hidden="true" /> {when}
          </p>
        )}
        <p className="line-clamp-4 text-sm leading-relaxed text-cream/90">{caption}</p>
        {post.status === "failed" && <p className="text-xs text-red-300">{c.failed}</p>}
        {notice && (
          <p role="status" className="text-xs text-stone">
            {notice}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-panel-3 px-4 py-3">
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" className={editable ? btnMain : btnQuiet}>
              <Pencil className="size-3.5" aria-hidden="true" /> {editable ? c.edit : c.open}
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto border-panel-3 bg-panel p-0 sm:max-w-2xl">
            <DialogHeader className="border-b border-panel-3 px-5 py-4 text-left">
              <DialogTitle className="text-base text-cream">{editable ? c.editTitle : c.readTitle}</DialogTitle>
              {editable && <DialogDescription className="text-xs text-stone">{c.editNote}</DialogDescription>}
            </DialogHeader>
            <div className="grid gap-5 p-5 sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-panel-3 bg-panel-2">
                {post.media_url && <Image src={post.media_url} alt={c.imageAlt} fill sizes="220px" className="object-cover" />}
              </div>
              <div className="flex min-w-0 flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-stone">
                  {c.caption}
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    onBlur={() => editable && caption !== post.caption && save()}
                    readOnly={!editable}
                    maxLength={1024}
                    rows={8}
                    className={cn(field, "resize-y py-2 leading-relaxed read-only:opacity-80")}
                  />
                </label>
                {canSchedule && (
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-stone">
                    {c.postAt}
                    <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className={cn(field, "h-9")} />
                  </label>
                )}
                {!canPublish && editable && <p className="text-xs text-stone">{c.noChannel}</p>}
                {notice && (
                  <p role="status" className="text-xs text-stone">
                    {notice}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap justify-end gap-2">
                  {post.status === "scheduled" && (
                    <button type="button" disabled={pending} onClick={() => startTransition(() => cancelSchedule(post.id))} className={btnQuiet}>
                      {c.cancel}
                    </button>
                  )}
                  {canSchedule && (
                    <button type="button" disabled={pending} onClick={schedule} className={btnMain}>
                      {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />} {c.approve}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {post.status === "scheduled" && (
          <button type="button" disabled={pending} onClick={() => startTransition(() => cancelSchedule(post.id))} className={btnQuiet}>
            {c.cancel}
          </button>
        )}
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className={btnQuiet}>
            {c.view} <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
        {post.campaign_id && post.media_url && (
          <a href={`/api/campaigns/${post.campaign_id}/pack?post=${post.id}`} aria-label={c.download} title={c.download} className={cn(btnQuiet, "ml-auto w-8 px-0")}>
            <Download className="size-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}
