"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendSellerReply, setAgentPaused } from "@/modules/channels";
import { requireSeller } from "../../session";

const Id = z.uuid();

export async function setTakeover(conversationId: string, paused: boolean): Promise<void> {
  const { store } = await requireSeller();
  await setAgentPaused(store.id, Id.parse(conversationId), paused);
  revalidatePath("/dashboard/inbox");
}

export async function sendReply(conversationId: string, body: string): Promise<{ ok: boolean }> {
  const { store } = await requireSeller();
  const text = z.string().trim().min(1).max(2000).parse(body);
  try {
    await sendSellerReply(store.id, Id.parse(conversationId), text);
  } catch {
    return { ok: false };
  }
  revalidatePath("/dashboard/inbox");
  return { ok: true };
}
