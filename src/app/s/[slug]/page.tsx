import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { customerChatUrl } from "@/modules/channels";
import { DraftBridge, getDraftStorefront, getLiveStorefront, SiteRenderer } from "@/modules/storefront";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ draft?: string | string[] }>;
};

async function draftFrom(searchParams: Props["searchParams"]) {
  const { draft } = await searchParams;
  return typeof draft === "string" ? getDraftStorefront(draft) : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const draft = await draftFrom(searchParams);
  if (draft) return { title: draft.kit.name, robots: { index: false, follow: false } };

  const { slug } = await params;
  const store = await getLiveStorefront(slug);
  if (!store) return { robots: { index: false } };

  // The og:image comes from ./opengraph-image.tsx next to this file.
  return {
    metadataBase: new URL(env().NEXT_PUBLIC_APP_URL),
    title: store.kit.name,
    description: store.kit.tagline,
    alternates: { canonical: `/s/${store.slug}` },
    openGraph: {
      title: store.kit.name,
      description: store.kit.tagline,
      url: `/s/${store.slug}`,
      siteName: store.kit.name,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: store.kit.name, description: store.kit.tagline },
  };
}

export default async function StorePage({ params, searchParams }: Props) {
  const draft = await draftFrom(searchParams);
  const { slug } = await params;
  const store = draft ?? (await getLiveStorefront(slug));
  if (!store) notFound();

  return (
    <>
      {draft && <DraftBridge />}
      <SiteRenderer
        config={store.config}
        kit={store.kit}
        products={store.products}
        contact={store.contact}
        chatUrl={customerChatUrl(store.slug)}
        locale={store.locale}
        checkout={draft ? undefined : { slug: store.slug, paypalClientId: env().NEXT_PUBLIC_PAYPAL_CLIENT_ID }}
      />
    </>
  );
}
