"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/messages";
import { campaignStatus } from "../../dashboard/campaigns/actions";

type PostStatus = Awaited<ReturnType<typeof campaignStatus>>;

/** Skeletons that fill in as the campaign job finishes. Stops asking once nothing is still being made. */
export function CampaignCard({ campaignId, count }: { campaignId: string; count: number }) {
  const [posts, setPosts] = useState<PostStatus | null>(null);
  const working = !posts || posts.some((p) => p.status === "generating");

  useEffect(() => {
    if (!working) return;
    let active = true;
    const load = () =>
      campaignStatus(campaignId)
        .then((next) => active && setPosts(next))
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [campaignId, working]);

  const failed = posts?.some((p) => p.status === "failed");
  const tiles = posts ?? Array.from({ length: count }, (_, i) => ({ id: String(i), status: "generating", mediaUrl: null }));

  return (
    <article className="my-2 w-full max-w-sm rounded-2xl border border-panel-3 bg-panel-2 p-4 text-cream">
      <h3 className="flex items-center gap-2 font-semibold">
        {working && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {working ? t.campaignCard.working : failed ? t.campaignCard.failed : t.campaignCard.ready}
      </h3>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map((post) => (
          <li key={post.id} className="aspect-square overflow-hidden rounded-lg bg-panel-3">
            {post.mediaUrl ? (
              <Image src={post.mediaUrl} alt={t.campaigns.imageAlt} width={200} height={200} className="size-full object-cover" />
            ) : (
              <div className="size-full animate-pulse bg-panel-3" />
            )}
          </li>
        ))}
      </ul>
      {!working && (
        <Link href="/dashboard/campaigns" className="mt-3 inline-flex min-h-11 items-center font-semibold text-lime underline">
          {t.campaignCard.open}
        </Link>
      )}
    </article>
  );
}
