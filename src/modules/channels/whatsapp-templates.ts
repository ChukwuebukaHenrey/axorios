/**
 * Templates the Inbox offers once the 24 h window has closed. Each must be approved on the seller's WhatsApp
 * Business account first; `hello_world` exists on every new account. Kapso's sandbox sends no templates at all.
 * Settings (6.12, Customer messages) will let sellers manage this list.
 */
export const WHATSAPP_TEMPLATES = [
  { name: "hello_world", language: "en_US", previewKey: "helloWorld" },
  { name: "order_update", language: "en", previewKey: "orderUpdate" },
  { name: "follow_up", language: "en", previewKey: "followUp" },
] as const;

export type WhatsAppTemplate = (typeof WHATSAPP_TEMPLATES)[number];

export function findTemplate(name: string): WhatsAppTemplate | undefined {
  return WHATSAPP_TEMPLATES.find((t) => t.name === name);
}

/** Open when the customer wrote in the last 24 h. A chat with no recorded window counts as closed. */
export function windowOpen(windowEndsAt: string | null, now = Date.now()): boolean {
  return windowEndsAt !== null && new Date(windowEndsAt).getTime() > now;
}
