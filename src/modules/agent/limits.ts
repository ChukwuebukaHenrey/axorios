import "server-only";
import { serviceRoleClient } from "@/lib/supabase/service-role";

export const MAX_TOOL_STEPS = 8;
export const DAILY_REQUEST_CAP = 300;

/** Counts one agent request for the store. Returns false once today's cap is reached. */
export async function consumeDailyRequest(storeId: string): Promise<boolean> {
  const db = serviceRoleClient();
  const { data, error } = await db
    .from("stores")
    .select("agent_requests_today, agent_requests_date")
    .eq("id", storeId)
    .single();
  if (error) throw new Error(`Usage read failed: ${error.code}`);

  const today = new Date().toISOString().slice(0, 10);
  const used = data.agent_requests_date === today ? data.agent_requests_today : 0;
  if (used >= DAILY_REQUEST_CAP) return false;

  const { error: updateError } = await db
    .from("stores")
    .update({ agent_requests_today: used + 1, agent_requests_date: today })
    .eq("id", storeId);
  if (updateError) throw new Error(`Usage update failed: ${updateError.code}`);
  return true;
}
