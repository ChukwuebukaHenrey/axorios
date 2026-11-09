import { NextResponse } from "next/server";
import { CustomerError, exportContact } from "@/modules/customers";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";
import { storeChoice } from "@/lib/store-cookie";

/** Privacy export of one contact as JSON, for the session's store only. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", _req.url), 307);
  const store = await getOrCreateStore(supabase, user.id, await storeChoice());
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id))
    return new NextResponse("Not found", { status: 404 });
  try {
    const data = await exportContact(store.id, id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="contact-${id.slice(0, 8)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof CustomerError)
      return new NextResponse("Not found", { status: 404 });
    throw e;
  }
}
