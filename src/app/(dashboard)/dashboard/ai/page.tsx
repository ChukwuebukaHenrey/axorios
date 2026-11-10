import { getBrandKit } from "@/modules/brand";
import { requireSeller } from "../../session";
import { AxoriPage } from "./axori-page";

export const metadata = { title: "Axori AI | AxoriOS" };

/** `?t=` opens a saved chat. `?prompt=` (links from other pages) prefills a new chat's composer; it is never sent by itself. */
export default async function AxoriAiPage({ searchParams }: { searchParams: Promise<{ t?: string; prompt?: string }> }) {
  const [{ t: thread, prompt }, { user, store }] = await Promise.all([searchParams, requireSeller()]);
  const kit = await getBrandKit(store.id);
  const valid = typeof thread === "string" && /^[0-9a-f-]{36}$/i.test(thread) ? thread : null;
  return (
    <AxoriPage
      initialThread={valid}
      initialPrompt={typeof prompt === "string" ? prompt.slice(0, 500) : ""}
      storeName={kit?.name ?? store.slug}
      greetingName={(user.user_metadata?.first_name as string | undefined) ?? ""}
    />
  );
}
