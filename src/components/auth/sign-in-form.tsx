"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { t } from "@/lib/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Field, Notice, OAuthButtons, PasswordField, PRIMARY, type Providers } from "./fields";

const l = t.landing;

/** Magic link by default, a password for the demo account. Same logic as before, in the new frame. */
export function SignInForm({ linkFailed, providers }: { linkFailed: boolean; providers: Providers }) {
  const router = useRouter();
  const [usePassword, setUsePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ text: linkFailed ? l.linkFailed : "", error: linkFailed });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email")).trim();
    setBusy(true);
    setNotice({ text: "", error: false });
    const supabase = createBrowserSupabase();

    if (usePassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: String(data.get("password")) });
      if (error) {
        setNotice({ text: l.signInFailed, error: true });
        setBusy(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setNotice(error ? { text: l.signInFailed, error: true } : { text: l.magicLinkSent, error: false });
    setBusy(false);
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label={l.emailLabel} name="email" type="email" required autoComplete="email" />
        {usePassword && <PasswordField label={l.passwordLabel} name="password" required autoComplete="current-password" />}
        <button type="submit" disabled={busy} className={`${PRIMARY} mt-1`}>
          {busy ? l.signingIn : usePassword ? l.signIn : l.magicLink}
        </button>
        <button
          type="button"
          onClick={() => setUsePassword(!usePassword)}
          className="self-start text-sm text-cream/75 underline underline-offset-4 hover:text-cream"
        >
          {usePassword ? l.magicToggle : l.passwordToggle}
        </button>
        <Notice {...notice} />
      </form>
      <OAuthButtons providers={providers} onNotice={(text) => setNotice({ text, error: true })} />
    </>
  );
}
