import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";
import { createServerSupabase } from "@/lib/supabase/server";
import { loadSellerSession } from "@/modules/agent";
import { getBrandKit, getOrCreateStore } from "@/modules/brand";
import { draftPreviewToken } from "@/modules/storefront";
import { BuilderChat } from "./builder-chat";

export const metadata = { title: "Build your store | AxoriOS" };

export default async function BuildPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const store = await getOrCreateStore(supabase, user.id);
  const [messages, kit] = await Promise.all([loadSellerSession(store.id), getBrandKit(store.id)]);
  const previewUrl = `/s/${store.slug}?draft=${draftPreviewToken(store.id)}`;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 bg-primary px-4 py-3 text-white">
        <Logo className="size-6" />
        <h1 className="font-semibold">{t.builder.title}</h1>
      </header>
      <BuilderChat initialMessages={messages} previewUrl={previewUrl} initialHasKit={kit !== null} />
    </div>
  );
}
