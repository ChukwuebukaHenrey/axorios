import "server-only";
import { cookies } from "next/headers";

/** The store switcher's choice. It only selects among the signed-in owner's own stores (checked on every read). */
export const STORE_COOKIE = "axorios_store";

export async function storeChoice(): Promise<string | null> {
  return (await cookies()).get(STORE_COOKIE)?.value ?? null;
}
