import "server-only";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { ChannelPausedError } from "./errors";
import { getChannel } from "./registry";
import type { ChannelName, OutboundMessage } from "./types";

type Outbound = { text: OutboundMessage } | { template: { name: string; language: string } };

async function setPaused(storeId: string, paused: boolean): Promise<void> {
  const db = serviceRoleClient().from("stores");
  const query = paused
    ? db.update({ whatsapp_paused_at: new Date().toISOString() }).eq("id", storeId)
    : db.update({ whatsapp_paused_at: null }).eq("id", storeId).not("whatsapp_paused_at", "is", null);
  const { error } = await query;
  if (error) throw new Error(`Pause flag update failed: ${error.code}`);
}

/**
 * Sends on the customer's channel for this store. A WhatsApp credit failure flags the store as paused (the Inbox
 * shows it) and is rethrown as non-retriable, so nothing loops; the next send that works clears the flag.
 */
export async function deliver(storeId: string, channel: ChannelName, to: string, out: Outbound): Promise<void> {
  const adapter = getChannel(channel);
  try {
    if ("template" in out) {
      if (!adapter.sendTemplate) throw new Error(`Templates aren't supported on ${channel}`);
      await adapter.sendTemplate(to, out.template);
    } else {
      await adapter.send(to, out.text);
    }
  } catch (error) {
    if (error instanceof ChannelPausedError) {
      console.warn(`[channels] ${channel} paused for store ${storeId}: ${error.message}`);
      await setPaused(storeId, true);
    }
    throw error;
  }
  if (channel === "whatsapp") await setPaused(storeId, false);
}

export async function whatsappPausedAt(storeId: string): Promise<string | null> {
  const { data, error } = await serviceRoleClient().from("stores").select("whatsapp_paused_at").eq("id", storeId).single();
  if (error) throw new Error(`Store read failed: ${error.code}`);
  return data.whatsapp_paused_at;
}
