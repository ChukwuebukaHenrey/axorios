// Spike 0.6: FX rates covering NGN, GHS, KES; convert 45,000 NGN to USD; cache for an hour.
// Run: npx tsx scripts/spike-fx.mts
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; rates: Record<string, number> }>();
let networkCalls = 0;

async function rates(base: string) {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rates;
  networkCalls++;
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!res.ok) throw new Error(`FX failed: HTTP ${res.status}`);
  const body = (await res.json()) as { result: string; rates: Record<string, number> };
  if (body.result !== "success") throw new Error("FX provider returned an error");
  cache.set(base, { at: Date.now(), rates: body.rates });
  return body.rates;
}

const usd = await rates("USD");
for (const code of ["NGN", "GHS", "KES"]) {
  if (!usd[code]) throw new Error(`Missing ${code}`);
  console.log(`1 USD = ${usd[code]} ${code}`);
}

const ngn = await rates("NGN");
const rate = ngn.USD;
const chargeMinor = Math.round(45000 * rate * 100);
console.log(`45,000 NGN = ${(chargeMinor / 100).toFixed(2)} USD at ${rate}`);

await rates("NGN");
if (networkCalls !== 2) throw new Error(`Cache miss: ${networkCalls} network calls`);
console.log(`PASS fx_source=open.er-api.com networkCalls=${networkCalls} (third lookup served from cache)`);
