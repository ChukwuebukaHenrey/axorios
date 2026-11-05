import "server-only";
import { activeProductCount, finishSync, productStepCount, recordSyncFailure, syncProductBatch } from "@/modules/platforms";
import { inngest, PLATFORM_SYNC } from "./client";

/** A batch of products per step, so a big catalog can't outrun the request limit. One sync at a time per store. */
export const platformSync = inngest.createFunction(
  {
    id: "platform-sync",
    retries: 2,
    concurrency: { key: "event.data.storeId", limit: 1 },
    triggers: [{ event: PLATFORM_SYNC }],
    onFailure: async ({ event, error }) => {
      const { storeId } = event.data.event.data as { storeId: string };
      await recordSyncFailure(storeId, error.message);
    },
  },
  async ({ event, step }) => {
    const { storeId } = event.data as { storeId: string };
    const count = await step.run("count-products", () => activeProductCount(storeId));

    for (let batch = 0; batch < productStepCount(count); batch++) {
      await step.run(`products-${batch}`, () => syncProductBatch(storeId, batch));
    }
    return step.run("finish", () => finishSync(storeId, count));
  },
);
