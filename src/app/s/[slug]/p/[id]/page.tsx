import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { t } from "@/lib/messages";
import { publishedPost } from "@/modules/creative";
import { allowedImage, getLiveStorefront, StoreFrame } from "@/modules/storefront";

type Props = { params: Promise<{ slug: string; id: string }> };

/** Where a demo publisher's permalink lands (Meta, TikTok, Google until real accounts exist). */
async function load({ params }: Props) {
  const { slug, id } = await params;
  const store = await getLiveStorefront(slug);
  if (!store) return null;
  const post = await publishedPost(store.storeId, id);
  return post ? { store, post } : null;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const found = await load(props);
  if (!found) return { robots: { index: false } };
  return { title: found.store.kit.name, description: found.post.caption.slice(0, 160), robots: { index: false, follow: true } };
}

export default async function PostPage(props: Props) {
  const found = await load(props);
  if (!found) notFound();
  const { store, post } = found;
  const image = allowedImage(post.media_url);

  return (
    <StoreFrame tokens={store.config.tokens} kit={store.kit} locale={store.locale} preset={store.config.preset} homeHref={`/s/${store.slug}`}>
      <main className="px-4 py-10 sm:px-8 md:py-16">
        <article className="mx-auto w-full max-w-xl">
          {image && (
            <Image src={image} alt={t.campaigns.imageAlt} width={1080} height={1080} priority className="aspect-square w-full rounded-2xl object-cover" />
          )}
          <p className="mt-6 text-lg leading-relaxed whitespace-pre-line">{post.caption}</p>
          <a
            href={`/s/${store.slug}`}
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-store-primary px-6 font-semibold text-store-on-primary"
          >
            {t.campaigns.shopNow} <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </article>
      </main>
    </StoreFrame>
  );
}
