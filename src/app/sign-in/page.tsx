import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { t } from "@/lib/messages";
import { authProviders } from "@/lib/supabase/auth-providers";

export const metadata = { title: "Sign in | AxoriOS" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, providers] = await Promise.all([searchParams, authProviders()]);
  const l = t.landing;

  return (
    <AuthShell
      title={l.signInTitle}
      subtitle={
        <>
          {l.signInSubtitle}{" "}
          <Link href="/sign-up" className="text-lime underline underline-offset-4 hover:text-lime/80">
            {l.signUpLink}
          </Link>
        </>
      }
    >
      <SignInForm linkFailed={error === "link"} providers={providers} />
    </AuthShell>
  );
}
