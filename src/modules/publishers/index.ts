import "server-only";
import { env } from "@/lib/env";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { DEMO_FLAG, DEMO_PUBLISHERS, demoPublisher } from "./adapters/demo";
import { telegramChannel } from "./adapters/telegram-channel";
import type { Publisher } from "./types";

export { packEntries } from "./pack";
export type { PackPost } from "./pack";
export type { PublishablePost, Publisher } from "./types";
export { buildZip } from "./zip";
export { demoPermalink, DEMO_PUBLISHERS } from "./adapters/demo";

/** Adding a vendor means one adapter file and one entry here. */
const registry: Record<string, Publisher> = {
  [telegramChannel.name]: telegramChannel,
  ...Object.fromEntries(DEMO_PUBLISHERS.map((n) => [n, demoPublisher(n, () => env().NEXT_PUBLIC_APP_URL)])),
};

export function getPublisher(name: string): Publisher {
  const publisher = registry[name];
  if (!publisher) throw new Error(`Unknown publisher: ${name}`);
  return publisher;
}

/**
 * Where this store's posts can go. There is one Telegram channel, so only the store named by
 * DEMO_STORE_SLUG may post to it: anyone can sign up, and their posts mustn't reach it.
 * The demo publishers (Meta, TikTok, Google) show as connected for the demo store only, each behind its flag.
 * Every other store still gets the download pack.
 */
export async function publishTargets(storeId: string): Promise<string[]> {
  const e = env();
  if (await storeSlug(storeId) !== e.DEMO_STORE_SLUG) return [];
  return [
    ...(e.TELEGRAM_CHANNEL_ID ? [telegramChannel.name] : []),
    ...DEMO_PUBLISHERS.filter((n) => e[DEMO_FLAG[n]] === "demo"),
  ];
}

/** The store's slug, for links back to a post. */
export async function storeSlug(storeId: string): Promise<string> {
  const { data, error } = await serviceRoleClient().from("stores").select("slug").eq("id", storeId).single();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  return data.slug;
}
