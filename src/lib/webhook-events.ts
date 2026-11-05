import "server-only";
import type { Json } from "@/lib/database.types";
import { serviceRoleClient } from "@/lib/supabase/service-role";

export type WebhookProvider = "paypal" | "twilio" | "telegram";

export async function markWebhookProcessed(provider: WebhookProvider, eventId: string): Promise<void> {
  const { error } = await serviceRoleClient()
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("event_id", eventId);
  if (error) throw new Error(`webhook_events update failed: ${error.code}`);
}

/** Stores an event once. Returns false when it was already recorded, so retries do no work. */
export async function recordWebhookEvent(provider: WebhookProvider, eventId: string, payload: Json): Promise<boolean> {
  const { data, error } = await serviceRoleClient()
    .from("webhook_events")
    .upsert({ provider, event_id: eventId, payload }, { onConflict: "provider,event_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`webhook_events insert failed: ${error.code}`);
  return data.length > 0;
}
