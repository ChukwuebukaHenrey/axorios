import "server-only";
import type { Json } from "@/lib/database.types";
import { serviceRoleClient } from "@/lib/supabase/service-role";

export type WebhookProvider = "paypal" | "twilio" | "telegram";

/** Stores an event once. Returns false when it was already recorded, so retries do no work. */
export async function recordWebhookEvent(provider: WebhookProvider, eventId: string, payload: Json): Promise<boolean> {
  const { data, error } = await serviceRoleClient()
    .from("webhook_events")
    .upsert({ provider, event_id: eventId, payload }, { onConflict: "provider,event_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`webhook_events insert failed: ${error.code}`);
  return data.length > 0;
}
