import "server-only";
import { NonRetriableError } from "inngest";
import { consumeDailyRequest, writeCampaignCopy } from "@/modules/agent";
import { campaignPostIds, failGeneratingPosts, finishPost } from "@/modules/creative";
import { CREATIVE_GENERATE, inngest } from "./client";

type CampaignEvent = { storeId: string; campaignId: string; brief: string };

/** Writes a campaign's copy once, then renders each post in its own step, so a retry never rewrites finished posts. */
export const creativeGenerate = inngest.createFunction(
  {
    id: "creative-generate",
    retries: 2,
    triggers: [{ event: CREATIVE_GENERATE }],
    onFailure: async ({ event }) => {
      const { storeId, campaignId } = event.data.event.data as CampaignEvent;
      await failGeneratingPosts(storeId, campaignId);
    },
  },
  async ({ event, step }) => {
    const { storeId, campaignId, brief } = event.data as CampaignEvent;

    const postIds = await step.run("load-posts", () => campaignPostIds(storeId, campaignId));
    if (postIds.length === 0) return { posts: 0 };

    const copy = await step.run("write-copy", async () => {
      if (!(await consumeDailyRequest(storeId))) throw new NonRetriableError("Daily request cap reached");
      return writeCampaignCopy(storeId, postIds.length, brief);
    });

    for (const [index, postId] of postIds.entries()) {
      await step.run(`post-${index}`, () => finishPost(storeId, postId, copy[index], index, postIds.length));
    }
    return { posts: postIds.length };
  },
);
