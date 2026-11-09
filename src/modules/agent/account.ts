import "server-only";
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, tool, toUIMessageStream, type UIMessage } from "ai";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { approvalPolicy } from "./approvals";
import { MAX_TOOL_STEPS } from "./limits";
import { textModel } from "./model";
import { CHOICES_TOOL } from "./seller";
import { collapseVoiceNotes } from "./voice";

const SYSTEM = `You are Axori AI, the assistant inside AxoriOS. This is an account thread: the owner is thinking about ideas, possibly before a business exists.
Reply in the language of the owner's latest message. Keep replies short, plain text, no markdown, no jargon.
Help them shape the idea: who buys, what to sell first, a rough price range they should check locally. Never invent final prices.
You can't change any store from here. The only action you have is create_store, which shows the owner an approval card; nothing is created until they press Approve. Offer it once the idea is clear. After it succeeds, tell them the new store is selected and they can keep going in its own thread.
When a request could mean two things, call offer_choices with 2 to 4 short options instead of asking several questions.`;

const IdeaSchema = z.object({
  idea: z.string().trim().min(3).max(300).describe("One sentence: what the business sells and to whom"),
  niche: z.string().trim().max(60).optional(),
  location: z.string().trim().max(80).optional(),
});

/** ownerId is closed over from the session; the model never supplies it. */
function accountTools(ownerId: string) {
  return {
    offer_choices: CHOICES_TOOL,
    create_store: tool({
      description: "Create a new, empty draft store for this idea. The owner approves a card first. Returns the new store's id.",
      inputSchema: IdeaSchema,
      execute: async (profile) => {
        const slug = `store-${crypto.randomUUID().slice(0, 8)}`;
        const { data, error } = await serviceRoleClient()
          .from("stores")
          .insert({ owner_id: ownerId, slug, business_profile: profile as unknown as Json })
          .select("id, slug")
          .single();
        if (error) return { error: "create_failed" };
        await serviceRoleClient()
          .from("activity_log")
          .insert({ owner_id: ownerId, store_id: data.id, actor: "axori_ai", action: "create_store", target: data.id });
        return { storeId: data.id, slug: data.slug };
      },
    }),
  };
}

export async function runAccountAgent(ownerId: string, messages: UIMessage[], save: (messages: UIMessage[]) => Promise<void>): Promise<Response> {
  const result = streamText({
    model: textModel(),
    system: SYSTEM,
    messages: await convertToModelMessages(collapseVoiceNotes(messages, { keepLatest: true })),
    tools: accountTools(ownerId),
    toolApproval: approvalPolicy(),
    stopWhen: isStepCount(MAX_TOOL_STEPS),
    maxRetries: 3,
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      onEnd: ({ messages: finished }) => save(collapseVoiceNotes(finished, { keepLatest: false })),
    }),
  });
}
