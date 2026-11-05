import { currencyDecimals } from "../../lib/money";

/** The rate as orders.fx_rate holds it. Charges use this same value, so the stored rate always explains the charge. */
export function lockRate(rate: number): number {
  const locked = Number(rate.toFixed(10));
  if (!Number.isFinite(locked) || locked <= 0) throw new Error("Unusable exchange rate");
  return locked;
}

/** Converts between minor units, respecting each currency's decimals. */
export function convertMinor(minor: number, from: string, to: string, lockedRate: number): number {
  const shift = 10 ** (currencyDecimals(to) - currencyDecimals(from));
  return Math.round(minor * lockedRate * shift);
}
