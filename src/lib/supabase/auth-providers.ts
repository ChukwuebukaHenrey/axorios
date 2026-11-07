import "server-only";
import { env } from "@/lib/env";

export type AuthProviders = { google: boolean; apple: boolean };

/** Which social sign-ins are switched on in Supabase. Public settings endpoint, cached for 5 minutes. */
export async function authProviders(): Promise<AuthProviders> {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } = env();
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 300 } });
    if (!res.ok) return { google: false, apple: false };
    const body = (await res.json()) as { external?: { google?: boolean; apple?: boolean } };
    return { google: Boolean(body.external?.google), apple: Boolean(body.external?.apple) };
  } catch {
    return { google: false, apple: false };
  }
}
