import "server-only";
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  APP_NAME: z.string().min(1).default("AxoriOS"),
  NEXT_PUBLIC_APP_URL: z.url(),

  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  GEMINI_TEXT_MODEL: z.string().min(1),
  GEMINI_IMAGE_MODEL: z.string().min(1),

  TEXT_MODEL_PROVIDER: z.enum(["google", "groq"]).default("google"),
  GROQ_API_KEY: optional,
  GROQ_TEXT_MODEL: optional,

  PAYPAL_ENV: z.literal("sandbox"),
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_WEBHOOK_ID: optional,

  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_WHATSAPP_FROM: z.string().startsWith("whatsapp:"),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_CHANNEL_ID: optional,

  SHOPIFY_STORE_DOMAIN: optional,
  SHOPIFY_CLIENT_ID: optional,
  SHOPIFY_CLIENT_SECRET: optional,

  INNGEST_EVENT_KEY: optional,
  INNGEST_SIGNING_KEY: optional,

  ENCRYPTION_KEY: z.string().min(32),
  DRAFT_PREVIEW_SECRET: z.string().min(32),

  DEMO_SELLER_EMAIL: optional,
  DEMO_SELLER_PASSWORD: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated on first use so `next build` doesn't require production secrets. Errors name keys, never values. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}
