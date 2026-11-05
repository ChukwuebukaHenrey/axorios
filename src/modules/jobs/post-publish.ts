import "server-only";
import { duePost, finishPublish, savePublishResults } from "@/modules/creative";
import { getPublisher } from "@/modules/publishers";
import { inngest, POST_PUBLISH } from "./client";

type PublishEvent = { storeId: string; postId: string; scheduledAt: string };

/** Waits for the approved time, then posts. Reads the post again on waking, so a cancel or reschedule is respected. */
export const postPublish = inngest.createFunction(
  {
    id: "post-publish",
    retries: 3,
    triggers: [{ event: POST_PUBLISH }],
    onFailure: async ({ event, error }) => {
      const { storeId, postId, scheduledAt } = event.data.event.data as PublishEvent;
      if (await duePost(storeId, postId, scheduledAt)) await finishPublish(storeId, postId, "failed", error.message);
    },
  },
  async ({ event, step }) => {
    const { storeId, postId, scheduledAt } = event.data as PublishEvent;
    await step.sleepUntil("wait-for-time", scheduledAt);

    return step.run("publish", async () => {
      const post = await duePost(storeId, postId, scheduledAt);
      if (!post) return { skipped: true };

      const results = { ...(post.publish_results as Record<string, unknown>) };
      for (const target of post.targets) {
        if (results[target]) continue; // Already posted by an earlier attempt.
        const { url } = await getPublisher(target).publish({ caption: post.caption, mediaUrl: post.media_url ?? undefined });
        results[target] = { url: url ?? null, at: new Date().toISOString() };
        await savePublishResults(storeId, postId, results);
      }
      await finishPublish(storeId, postId, "published");
      return { published: post.targets };
    });
  },
);
