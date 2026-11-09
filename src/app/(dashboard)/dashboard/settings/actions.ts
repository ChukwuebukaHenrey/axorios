"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { STORE_COOKIE } from "@/lib/store-cookie";
import { logActivity, setDisplayName, setToolPermission } from "@/modules/agent";
import { disconnectShop } from "@/modules/platforms";
import { requireSeller } from "../../session";

const PermissionInput = z.object({ tool: z.string().regex(/^[a-z_]{1,40}$/), value: z.enum(["always", "approve", "blocked"]) });

/** Settings › Axori AI and Connections. The module refuses anything looser than the default. */
export async function savePermission(tool: string, value: string): Promise<{ ok: boolean }> {
  const parsed = PermissionInput.safeParse({ tool, value });
  if (!parsed.success) return { ok: false };
  const { supabase, user } = await requireSeller();
  const result = await setToolPermission(supabase, user.id, parsed.data.tool, parsed.data.value);
  revalidatePath("/dashboard/settings");
  return result;
}

export async function saveName(name: string): Promise<{ ok: boolean }> {
  const parsed = z.string().trim().max(80).safeParse(name);
  if (!parsed.success) return { ok: false };
  const { supabase, user } = await requireSeller();
  await setDisplayName(supabase, user.id, parsed.data);
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/** "Log out everywhere": ends every session for this user, this one included. */
export async function signOutEverywhere(): Promise<void> {
  const { supabase, user } = await requireSeller();
  await logActivity({ ownerId: user.id, actor: "seller", action: "log_out_everywhere" });
  await supabase.auth.signOut({ scope: "global" });
  (await cookies()).delete(STORE_COOKIE);
  redirect("/sign-in");
}

/** Disconnect Shopify for the selected store, after the seller read the effect in the dialog. */
export async function disconnectShopify(): Promise<void> {
  const { user, store } = await requireSeller();
  await disconnectShop(store.id);
  await logActivity({ ownerId: user.id, storeId: store.id, actor: "seller", action: "disconnect_shopify" });
  revalidatePath("/dashboard/settings");
}
