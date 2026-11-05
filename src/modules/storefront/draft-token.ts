import { createHmac, timingSafeEqual } from "node:crypto";

const LIFETIME_MS = 24 * 60 * 60 * 1000;

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** A 24 h link to one store's draft. The store comes from the signed token, never from the URL. */
export function signDraftToken(storeId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(`${storeId}.${now + LIFETIME_MS}`).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

/** Returns the store ID, or null if the token is forged, malformed or expired. */
export function verifyDraftToken(token: string, secret: string, now = Date.now()): string | null {
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;

  const expected = Buffer.from(signature(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const [storeId, expiry] = Buffer.from(payload, "base64url").toString().split(".");
  if (!storeId || !(Number(expiry) > now)) return null;
  return storeId;
}
