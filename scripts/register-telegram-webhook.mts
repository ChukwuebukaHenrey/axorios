// Points the bot at the production webhook and shows Telegram's view of it. Safe to re-run. Prints no secrets.
// Run: npx tsx --env-file=.env.local scripts/register-telegram-webhook.mts
const url = "https://axorios.vercel.app/api/webhooks/telegram";
const api = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const res = await fetch(`${api}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message"] }),
});
const set = (await res.json()) as { ok: boolean; description?: string };
if (!set.ok) throw new Error(`setWebhook failed: HTTP ${res.status} ${set.description ?? ""}`);

const info = (await (await fetch(`${api}/getWebhookInfo`)).json()) as {
  result: { url: string; pending_update_count: number; last_error_message?: string; allowed_updates?: string[] };
};
const { url: registered, pending_update_count: pending, last_error_message: lastError, allowed_updates: allowed } = info.result;
console.log({ registered, pending, allowed, lastError: lastError ?? "none" });
