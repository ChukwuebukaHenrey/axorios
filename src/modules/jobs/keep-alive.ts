import "server-only";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { inngest } from "./client";

/** Free Supabase projects pause after a week idle, and judging runs 1-15 Dec. One small read a day keeps it awake. */
export const keepAlive = inngest.createFunction(
  { id: "keep-alive", retries: 3, triggers: [{ cron: "0 6 * * *" }] },
  async ({ step }) =>
    step.run("touch-database", async () => {
      const { error, count } = await serviceRoleClient().from("stores").select("id", { count: "exact", head: true });
      if (error) throw new Error(`Keep-alive read failed: ${error.code}`);
      return { stores: count };
    }),
);
