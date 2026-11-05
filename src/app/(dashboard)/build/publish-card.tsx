import { ExternalLink, Globe } from "lucide-react";
import { t } from "@/lib/messages";

type PublishPart = {
  state?: string;
  output?: unknown;
  approval?: { id: string; isAutomatic?: boolean };
};

/** Nothing goes public from the model's word alone: publish_store waits here for the seller's answer. */
export function PublishCard({
  part,
  onRespond,
}: {
  part: PublishPart;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const shell = "my-2 w-full max-w-sm rounded-2xl border border-black/10 bg-white p-4 shadow-sm";

  if (part.state === "approval-requested" && part.approval && !part.approval.isAutomatic) {
    const { id } = part.approval;
    return (
      <article className={shell}>
        <h3 className="flex items-center gap-2 font-semibold">
          <Globe className="size-5 text-secondary" aria-hidden="true" /> {t.publishCard.title}
        </h3>
        <p className="mt-1 text-sm text-black/70">{t.publishCard.body}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onRespond(id, true)}
            className="h-11 flex-1 rounded-xl bg-primary font-semibold text-white transition hover:opacity-90"
          >
            {t.publishCard.approve}
          </button>
          <button
            type="button"
            onClick={() => onRespond(id, false)}
            className="h-11 flex-1 rounded-xl border border-black/15 font-semibold transition hover:bg-black/5"
          >
            {t.publishCard.deny}
          </button>
        </div>
      </article>
    );
  }

  if (part.state === "output-available") {
    const { url } = part.output as { url: string };
    return (
      <article className={shell}>
        <h3 className="font-semibold">{t.publishCard.live}</h3>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex items-center gap-1.5 text-sm font-medium break-all text-primary underline"
        >
          {url} <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
        </a>
      </article>
    );
  }

  if (part.state === "output-denied") {
    return <p className="my-2 text-sm text-black/60">{t.publishCard.denied}</p>;
  }

  return null;
}
