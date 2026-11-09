"use server";

import { revalidatePath } from "next/cache";
import {
  createLabel,
  CustomerError,
  deleteContact,
  deleteLabel,
  mergeContacts,
  setContactLabel,
  updateLabel,
} from "@/modules/customers";
import { requireSeller } from "../../session";

export type ActionResult =
  { ok: true } | { ok: false; error: string; detail?: string[] };

/** Every action takes the store from the session; ids from the browser are checked against it in the module. */
async function run(
  fn: (storeId: string) => Promise<unknown>,
): Promise<ActionResult> {
  const { store } = await requireSeller();
  try {
    await fn(store.id);
    revalidatePath("/dashboard/customers", "layout");
    revalidatePath("/dashboard/inbox");
    return { ok: true };
  } catch (e) {
    if (e instanceof CustomerError)
      return { ok: false, error: e.message, detail: e.detail };
    console.error(e);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export const addLabel = async (name: string, colour: string) =>
  run((s) => createLabel(s, name, colour));
export const editLabel = async (
  id: string,
  patch: { name?: string; colour?: string },
) => run((s) => updateLabel(s, id, patch));
export const removeLabel = async (id: string) => run((s) => deleteLabel(s, id));
export const toggleLabel = async (
  contactId: string,
  labelId: string,
  on: boolean,
) => run((s) => setContactLabel(s, contactId, labelId, on));
export const merge = async (keepId: string, mergeId: string) =>
  run((s) => mergeContacts(s, keepId, mergeId));
export const removeContact = async (contactId: string) =>
  run((s) => deleteContact(s, contactId));
