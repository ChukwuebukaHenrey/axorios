import "server-only";
import { convertMinor, lockRate } from "./convert";

const FX_SOURCE = "open.er-api.com";
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; rates: Record<string, number> }>();

async function ratesFrom(base: string): Promise<Record<string, number>> {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rates;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (body.result !== "success" || !body.rates) throw new Error("provider error");
    cache.set(base, { at: Date.now(), rates: body.rates });
    return body.rates;
  } catch (error) {
    // The provider updates daily, so a rate a few hours old beats refusing a sale.
    if (hit) return hit.rates;
    throw new Error(`FX rates failed: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

export type Quote = { chargeMinor: number; rate: number; source: string };

export async function quote(amountMinor: number, from: string, to: string): Promise<Quote> {
  const raw = (await ratesFrom(from))[to];
  if (!raw) throw new Error(`No exchange rate from ${from} to ${to}`);
  const rate = lockRate(raw);
  return { chargeMinor: convertMinor(amountMinor, from, to, rate), rate, source: FX_SOURCE };
}
