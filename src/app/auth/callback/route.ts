import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

/** Completes the magic-link sign-in. */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  const base = env().NEXT_PUBLIC_APP_URL;
  if (!code) return NextResponse.redirect(`${base}/?error=link`);

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(error ? `${base}/?error=link` : `${base}/build`);
}
