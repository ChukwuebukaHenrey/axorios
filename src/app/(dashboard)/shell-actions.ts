"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { STORE_COOKIE } from "@/lib/store-cookie";
import { createServerSupabase } from "@/lib/supabase/server";
import { createThread, deleteThread, getThread, listThreads, type Thread, type ThreadSummary } from "@/modules/agent";
import { createOwnerStore, getOrCreateStore, listOwnerStores } from "@/modules/brand";

async function signedIn() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 } as const;

/** Log out of this device only (avatar menu and Settings). "Log out everywhere" is in Settings › Sign-in & security. */
export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(STORE_COOKIE);
  redirect("/sign-in");
}

/** Store switcher. Only one of the owner's own stores can be chosen. */
export async function switchStore(storeId: string): Promise<{ ok: boolean }> {
  const { supabase, user } = await signedIn();
  const stores = await listOwnerStores(supabase, user.id);
  if (!stores.some((s) => s.id === storeId)) return { ok: false };
  (await cookies()).set(STORE_COOKIE, storeId, COOKIE_OPTIONS);
  return { ok: true };
}

/** "New business" in the switcher: an empty draft store, selected, with Axori AI ready to set it up. */
export async function newBusiness(): Promise<{ storeId: string }> {
  const { supabase, user } = await signedIn();
  const store = await createOwnerStore(supabase, user.id);
  (await cookies()).set(STORE_COOKIE, store.id, COOKIE_OPTIONS);
  return { storeId: store.id };
}

const ScopeSchema = z.enum(["store", "account"]);

export async function startThread(scope: "store" | "account"): Promise<{ id: string }> {
  const { supabase, user } = await signedIn();
  const store = await getOrCreateStore(supabase, user.id, (await cookies()).get(STORE_COOKIE)?.value);
  const id = await createThread(supabase, user.id, ScopeSchema.parse(scope) === "store" ? store.id : null);
  return { id };
}

export async function openThread(threadId: string): Promise<Thread | null> {
  const { supabase } = await signedIn();
  return z.uuid().safeParse(threadId).success ? getThread(supabase, threadId) : null;
}

export async function threadList(): Promise<ThreadSummary[]> {
  const { supabase, user } = await signedIn();
  const store = await getOrCreateStore(supabase, user.id, (await cookies()).get(STORE_COOKIE)?.value);
  return listThreads(supabase, user.id, store.id);
}

export async function removeThread(threadId: string): Promise<void> {
  const { supabase } = await signedIn();
  if (z.uuid().safeParse(threadId).success) await deleteThread(supabase, threadId);
}
