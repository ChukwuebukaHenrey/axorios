import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { env } from "@/lib/env";

/** The agent's text model, chosen by TEXT_MODEL_PROVIDER. Errors name keys, never values. */
export function textModel(): LanguageModel {
  const e = env();
  if (e.TEXT_MODEL_PROVIDER === "google") return google(e.GEMINI_TEXT_MODEL);
  if (!e.GROQ_API_KEY || !e.GROQ_TEXT_MODEL) {
    throw new Error("TEXT_MODEL_PROVIDER=groq needs GROQ_API_KEY and GROQ_TEXT_MODEL");
  }
  return createGroq({ apiKey: e.GROQ_API_KEY })(e.GROQ_TEXT_MODEL);
}
