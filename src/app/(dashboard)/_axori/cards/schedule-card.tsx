"use client";

import { CalendarClock } from "lucide-react";
import { t } from "@/lib/messages";

type SchedulePart = {
  state?: string;
  input?: { posts?: { postId: string; scheduledAt: string }[] };
  output?: { scheduled?: unknown[]; error?: string };
  approval?: { id: string; isAutomatic?: boolean };
};

/** Nothing is scheduled from the model's word alone: schedule_posts waits here for the seller's answer. */
export function ScheduleCard({ part, onRespond }: { part: SchedulePart; onRespond: (approvalId: string, approved: boolean) => void }) {
  const shell = "my-2 w-full max-w-sm rounded-2xl border border-panel-3 bg-panel-2 p-4 text-cream";

  if (part.state === "approval-requested" && part.approval && !part.approval.isAutomatic) {
    const { id } = part.approval;
    const posts = part.input?.posts ?? [];
    const times = [...new Set(posts.map((p) => p.scheduledAt))];
    return (
      <article className={shell}>
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarClock className="size-5 text-secondary" aria-hidden="true" /> {t.scheduleCard.title}
        </h3>
        <p className="mt-1 text-sm text-stone">
          {posts.length === 1 ? t.scheduleCard.bodyOne : t.scheduleCard.bodyMany.replace("{count}", String(posts.length))}
        </p>
        <ul className="mt-1 text-sm font-semibold">
          {times.map((time) => (
            <li key={time} suppressHydrationWarning>
              {new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onRespond(id, true)} className="h-11 flex-1 rounded-lg bg-lime font-semibold text-black transition hover:bg-lime/85">
            {t.scheduleCard.approve}
          </button>
          <button type="button" onClick={() => onRespond(id, false)} className="h-11 flex-1 rounded-lg border border-cream/20 font-semibold transition hover:bg-white/5">
            {t.scheduleCard.deny}
          </button>
        </div>
      </article>
    );
  }

  if (part.state === "output-available") {
    return <p className="my-2 text-sm font-medium">{part.output?.error ? t.scheduleCard.refused : t.scheduleCard.done}</p>;
  }
  if (part.state === "output-denied") {
    return <p className="my-2 text-sm text-stone">{t.scheduleCard.denied}</p>;
  }
  return null;
}
