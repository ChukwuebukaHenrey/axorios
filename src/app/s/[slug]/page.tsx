import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { getLiveStorefront, SiteRenderer } from "@/modules/storefront";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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

export default async function StorePage({ params }: Props) {
  const { slug } = await params;
  const store = await getLiveStorefront(slug);
  if (!store) notFound();

  return (
    <SiteRenderer
      config={store.config}
      kit={store.kit}
      products={store.products}
      contact={store.contact}
      locale={store.locale}
    />
  );
}
