import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { t } from "@/lib/messages";
import { authProviders } from "@/lib/supabase/auth-providers";

export const metadata = { title: "Create an account | AxoriOS" };

export default async function SignUpPage() {
  const providers = await authProviders();
  const l = t.landing;

  return (
    <AuthShell
      title={l.signUpTitle}
      subtitle={
        <>
          {l.signUpSubtitle}{" "}
          <Link href="/sign-in" className="text-lime underline underline-offset-4 hover:text-lime/80">
            {l.signInLink}
          </Link>
        </>
      }
    >
      <SignUpForm providers={providers} />
    </AuthShell>
  );
}
