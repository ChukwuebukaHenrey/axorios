import { storeChoice } from "@/lib/store-cookie";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";
import { listPosts } from "@/modules/creative";
import { buildZip, packEntries } from "@/modules/publishers";
import { allowedImage } from "@/modules/storefront";

/** A campaign's posts as a zip, or one post with ?post=. Only the signed-in owner's posts can be found. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first", { status: 401 });

  const { id } = await params;
  const only = new URL(req.url).searchParams.get("post");
  const store = await getOrCreateStore(supabase, user.id, await storeChoice());
  const posts = (await listPosts(supabase, store.id)).filter(
    (p) => p.campaign_id === id && p.status !== "generating" && (!only || p.id === only),
  );

  const ready = await Promise.all(
    posts.map(async ({ caption, suggested_at, media_url }) => {
      const url = allowedImage(media_url); // Only our own storage, whatever the row says.
      if (!url) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      return { caption, suggestedAt: suggested_at, image: new Uint8Array(await res.arrayBuffer()) };
    }),
  );
  const found = ready.filter((p) => p !== null);
  if (found.length === 0) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(buildZip(packEntries(found))), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="axorios-posts.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
