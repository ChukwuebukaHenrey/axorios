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
  // spec v2 names: "cloudflare" and "og" are aliases for "cloudflare-flux" and "template".
  IMAGE_PROVIDER: z
    .enum(["template", "og", "cloudflare-flux", "cloudflare"])
    .default("template")
    .transform((v) => (v === "cloudflare" ? "cloudflare-flux" : v === "og" ? "template" : v)),
  CLOUDFLARE_ACCOUNT_ID: optional,
  CLOUDFLARE_AI_TOKEN: optional,
  CLOUDFLARE_IMAGE_MODEL: optional,

  TEXT_MODEL_PROVIDER: z.enum(["google", "groq"]).default("google"),
  GROQ_API_KEY: optional,
  GROQ_TEXT_MODEL: optional,

  PAYPAL_ENV: z.literal("sandbox"),
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_WEBHOOK_ID: optional,

  WHATSAPP_ENABLED: z.enum(["true", "false"]).default("false"),
  TWILIO_ACCOUNT_SID: optional,
  TWILIO_AUTH_TOKEN: optional,
  TWILIO_WHATSAPP_FROM: optional,

  WHATSAPP_PROVIDER: z.enum(["off", "kapso", "twilio"]).default("off"),
  KAPSO_API_KEY: optional,
  KAPSO_PHONE_NUMBER_ID: optional,
  KAPSO_WEBHOOK_SECRET: optional,

  META_PROVIDER: z.enum(["off", "demo"]).default("demo"),
  TIKTOK_PROVIDER: z.enum(["off", "demo"]).default("demo"),
  GOOGLE_PROVIDER: z.enum(["off", "demo"]).default("demo"),

  AG_STUDIO_ENABLED: z.enum(["true", "false"]).default("true"),
  AG_STUDIO: optional,

  ZAPIER_ENABLED: z.enum(["true", "false"]).default("false"),
  ZAPIER_MCP_URL: optional,
  ZAPIER_MCP_TOKEN: optional,
  ZAPIER_SHEET_SPREADSHEET_ID: optional,
  ZAPIER_SHEET_WORKSHEET_ID: optional,
  ZAPIER_SHEET_LABEL: optional,

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_CHANNEL_ID: optional,
  DEMO_STORE_SLUG: z.string().min(1).default("demo"),
  TELEGRAM_BOT_USERNAME: optional,

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

/** A selected vendor must have its keys; a dormant one may leave them blank. */
const checked = schema.superRefine((e, ctx) => {
  const need = (keys: readonly (keyof typeof e)[], why: string) => {
    for (const key of keys) if (!e[key]) ctx.addIssue({ code: "custom", path: [key], message: `Required when ${why}` });
  };
  if (e.IMAGE_PROVIDER === "cloudflare-flux") {
    need(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_AI_TOKEN", "CLOUDFLARE_IMAGE_MODEL"], "IMAGE_PROVIDER=cloudflare-flux");
  }
  if (e.WHATSAPP_PROVIDER === "kapso") {
    need(["KAPSO_API_KEY", "KAPSO_PHONE_NUMBER_ID", "KAPSO_WEBHOOK_SECRET"], "WHATSAPP_PROVIDER=kapso");
  }
  if (e.ZAPIER_ENABLED === "true") need(["ZAPIER_MCP_URL", "ZAPIER_MCP_TOKEN", "ZAPIER_SHEET_SPREADSHEET_ID", "ZAPIER_SHEET_WORKSHEET_ID"], "ZAPIER_ENABLED=true");
});

export type Env = z.infer<typeof checked>;

let cached: Env | undefined;

/** Validated on first use so `next build` doesn't require production secrets. Errors name keys, never values. */
export function env(): Env {
  if (cached) return cached;
  const parsed = checked.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}
