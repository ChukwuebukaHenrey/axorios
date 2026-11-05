"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { t } from "@/lib/messages";
import type { Post } from "@/modules/creative";
import { approveAndSchedule, cancelSchedule, saveCaption } from "./actions";

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

export function PostCard({ post, canPublish }: { post: Post; canPublish: boolean }) {
  const [caption, setCaption] = useState(post.caption);
  const [time, setTime] = useState(() => defaultTime(post));
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shell = "flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm";

  if (post.status === "generating") {
    return (
      <article className={shell}>
        <div className="grid aspect-square animate-pulse place-items-center bg-black/5">
          <Loader2 className="size-6 animate-spin text-black/40" aria-hidden="true" />
        </div>
        <p className="p-4 text-sm text-black/60">{t.campaigns.generating}</p>
      </article>
    );
  }

  const editable = post.status === "draft" || post.status === "failed" || post.status === "scheduled";

  function save() {
    startTransition(async () => {
      const result = await saveCaption(post.id, caption);
      setNotice(result.ok ? t.campaigns.saved : t.campaigns.errorGeneric);
    });
  }

  function schedule() {
    startTransition(async () => {
      const at = new Date(time);
      if (Number.isNaN(at.getTime())) return setNotice(t.campaigns.errorTime);
      const saved = caption === post.caption ? { ok: true as const } : await saveCaption(post.id, caption);
      if (!saved.ok) return setNotice(t.campaigns.errorGeneric);
      const result = await approveAndSchedule(post.id, at.toISOString());
      if (result.ok) return setNotice(null);
      setNotice(result.error === "time_in_past" || result.error === "time_too_far" ? t.campaigns.errorTime : t.campaigns.errorGeneric);
    });
  }

  const url = publishedUrl(post);
  return (
    <article className={shell}>
      {post.media_url && (
        <Image src={post.media_url} alt={t.campaigns.imageAlt} width={1080} height={1080} className="aspect-square w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {post.status === "scheduled" && post.scheduled_at && (
          <p className="rounded-lg bg-accent/40 px-3 py-2 text-sm font-semibold">{t.campaigns.scheduledFor.replace("{time}", showTime(post.scheduled_at))}</p>
        )}
        {post.status === "published" && (
          <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900">
            {t.campaigns.published.replace("{time}", post.scheduled_at ? showTime(post.scheduled_at) : "")}
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 underline">
                {t.campaigns.view} <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </p>
        )}
        {post.status === "failed" && <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-900">{t.campaigns.failed}</p>}

        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          {t.campaigns.caption}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => editable && caption !== post.caption && save()}
            readOnly={!editable}
            maxLength={1024}
            rows={6}
            className="w-full flex-1 rounded-xl border border-black/15 p-3 text-base font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>

        {editable && canPublish && post.status !== "scheduled" && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t.campaigns.postAt}
              <input
                type="datetime-local"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11 rounded-xl border border-black/15 px-3 text-base font-normal"
              />
            </label>
            <button type="button" disabled={pending} onClick={schedule} className="h-11 rounded-xl bg-primary font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {t.campaigns.approve}
            </button>
          </>
        )}
        {post.status === "scheduled" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => cancelSchedule(post.id))}
            className="h-11 rounded-xl border border-black/15 font-semibold transition hover:bg-black/5 disabled:opacity-50"
          >
            {t.campaigns.cancel}
          </button>
        )}
        {!canPublish && editable && <p className="text-sm text-black/60">{t.campaigns.noChannel}</p>}
        {notice && (
          <p role="status" className="text-sm text-black/70">
            {notice}
          </p>
        )}
        {post.campaign_id && post.media_url && (
          <a href={`/api/campaigns/${post.campaign_id}/pack?post=${post.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">
            {t.campaigns.download}
          </a>
        )}
      </div>
    </article>
  );
}
