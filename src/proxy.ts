import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the session on seller routes and sends signed-out visitors to sign-in. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Verifies the JWT locally against the cached JWKS (asymmetric keys), refreshing an expiring session first.
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return NextResponse.redirect(new URL("/sign-in", request.url));
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
