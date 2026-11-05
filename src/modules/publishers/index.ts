import "server-only";
import { env } from "@/lib/env";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { telegramChannel } from "./adapters/telegram-channel";
import type { Publisher } from "./types";

export { packEntries } from "./pack";
export type { PackPost } from "./pack";
export type { PublishablePost, Publisher } from "./types";
export { buildZip } from "./zip";

/** Adding a vendor means one adapter file and one entry here. */
const registry: Record<string, Publisher> = {
  [telegramChannel.name]: telegramChannel,
};

export function getPublisher(name: string): Publisher {
  const publisher = registry[name];
  if (!publisher) throw new Error(`Unknown publisher: ${name}`);
  return publisher;
}

/**
 * Where this store's posts can go. There is one Telegram channel, so only the store named by
 * TELEGRAM_CHANNEL_STORE_SLUG may post to it: anyone can sign up, and their posts mustn't reach it.
 * Every other store still gets the download pack.
 */
export async function publishTargets(storeId: string): Promise<string[]> {
  const e = env();
  if (!e.TELEGRAM_CHANNEL_ID) return [];
  const { data, error } = await serviceRoleClient().from("stores").select("slug").eq("id", storeId).single();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  return data.slug === e.TELEGRAM_CHANNEL_STORE_SLUG ? [telegramChannel.name] : [];
}
