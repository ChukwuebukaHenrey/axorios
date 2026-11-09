"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendSellerReply, setAgentPaused, WHATSAPP_TEMPLATES, type ReplyResult } from "@/modules/channels";
import { requireSeller } from "../../session";

const Id = z.uuid();
const TemplateName = z.enum(WHATSAPP_TEMPLATES.map((x) => x.name) as [string, ...string[]]);

export async function setTakeover(conversationId: string, paused: boolean): Promise<void> {
  const { store } = await requireSeller();
  await setAgentPaused(store.id, Id.parse(conversationId), paused);
  revalidatePath("/dashboard/inbox");
}

export async function sendReply(conversationId: string, body: string): Promise<ReplyResult> {
  const { store } = await requireSeller();
  const text = z.string().trim().min(1).max(2000).parse(body);
  const result = await sendSellerReply(store.id, Id.parse(conversationId), { text }).catch((): ReplyResult => ({ ok: false, reason: "failed" }));
  revalidatePath("/dashboard/inbox");
  return result;
}

/** After WhatsApp's 24 h window, only an approved template may go out. */
export async function sendTemplate(conversationId: string, name: string): Promise<ReplyResult> {
  const { store } = await requireSeller();
  const template = TemplateName.parse(name);
  const result = await sendSellerReply(store.id, Id.parse(conversationId), { template }).catch((): ReplyResult => ({ ok: false, reason: "failed" }));
  revalidatePath("/dashboard/inbox");
  return result;
}
