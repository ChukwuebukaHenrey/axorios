"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { t } from "@/lib/messages";
import type { Post } from "@/modules/creative";

// Times show in the seller's own timezone, which only the browser knows, so post cards render there.
const PostCard = dynamic(() => import("./post-card").then((m) => m.PostCard), { ssr: false });

export function CampaignBoard({ posts, canPublish }: { posts: Post[]; canPublish: boolean }) {
  const router = useRouter();
  const generating = posts.some((p) => p.status === "generating");
  const scheduled = posts.some((p) => p.status === "scheduled");

  useEffect(() => {
    if (!generating && !scheduled) return;
    const timer = setInterval(() => router.refresh(), generating ? 3000 : 15000);
    return () => clearInterval(timer);
  }, [generating, scheduled, router]);

  if (posts.length === 0) {
    return <p className="rounded-2xl border border-panel-3 bg-panel p-6 text-stone">{t.campaigns.empty}</p>;
  }

  const campaigns = [...new Set(posts.map((p) => p.campaign_id).filter(Boolean))] as string[];
  return (
    <div className="space-y-8">
      {campaigns.map((campaignId) => {
        const group = posts.filter((p) => p.campaign_id === campaignId);
        return (
          <section key={campaignId}>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} canPublish={canPublish} />
                </li>
              ))}
            </ul>
            {group.some((p) => p.media_url) && (
              <a href={`/api/campaigns/${campaignId}/pack`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-lime underline">
                {t.campaigns.downloadCampaign}
              </a>
            )}
          </section>
        );
      })}
    </div>
  );
}
