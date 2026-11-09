// Kept free of server-only imports so the quota rules are unit-tested.

/** Raised when Cloudflare is out of capacity or the account's allocation: the post still ships, as a template. */
export class ImageQuotaError extends Error {}

/**
 * Workers AI answers 429 when rate limited and an error envelope when the daily neuron allocation is spent
 * (code 3036) or the model is out of capacity (3040). Both mean "try the template", not "fail the post".
 */
export function isQuotaFailure(status: number, body: string): boolean {
  if (status === 429) return true;
  return /\b(3036|3040)\b|quota|neurons|allocation|rate.?limit|capacity/i.test(body);
}
