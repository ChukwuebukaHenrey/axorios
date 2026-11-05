import "server-only";
import { generateText, Output } from "ai";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { getBrandKit } from "@/modules/brand";
import { listProducts } from "@/modules/catalog";
import { CampaignCopySchema, campaignPrompt, type PostCopy } from "@/modules/creative";
import { textModel } from "./model";

/** One model call for the whole campaign, so the posts are written to differ from each other. */
export async function writeCampaignCopy(storeId: string, count: number, brief: string): Promise<PostCopy[]> {
  const [kit, products, store] = await Promise.all([
    getBrandKit(storeId),
    listProducts(storeId),
    serviceRoleClient().from("stores").select("store_language").eq("id", storeId).single(),
  ]);
  if (!kit) throw new Error("Store has no brand kit");
  if (store.error) throw new Error(`Store read failed: ${store.error.code}`);

  const { system, prompt } = campaignPrompt(
    kit,
    products.map(({ id, name, description }) => ({ id, name, description })),
    brief,
    count,
    store.data.store_language,
  );
  const { output } = await generateText({
    model: textModel(),
    system,
    prompt,
    output: Output.object({ schema: CampaignCopySchema }),
    maxRetries: 3,
  });
  if (output.posts.length < count) throw new Error(`Model wrote ${output.posts.length} of ${count} posts`);
  return output.posts.slice(0, count);
}
