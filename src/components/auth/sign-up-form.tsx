"use client";

import { useState, type FormEvent } from "react";
import { t } from "@/lib/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Field, Notice, OAuthButtons, PasswordField, PRIMARY, type Providers } from "./fields";

const l = t.landing;
const REPO_URL = "https://github.com/ChukwuebukaHenrey/axorios";

export function SignUpForm({ providers }: { providers: Providers }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ text: "", error: false });
  const fail = (text: string) => setNotice({ text, error: true });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password"));
    if (password.length < 8) return fail(l.passwordTooShort);
    if (!data.get("terms")) return fail(l.termsRequired);

    setBusy(true);
    setNotice({ text: "", error: false });
    const { error } = await createBrowserSupabase().auth.signUp({
      email: String(data.get("email")).trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { first_name: String(data.get("firstName")).trim(), last_name: String(data.get("lastName")).trim() },
      },
    });
    setBusy(false);
    setNotice(error ? { text: l.signUpFailed, error: true } : { text: l.signUpSent, error: false });
  }

  const link = "text-lime underline underline-offset-4 hover:text-lime/80";

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label={l.firstNameLabel} name="firstName" required autoComplete="given-name" />
          <Field label={l.lastNameLabel} name="lastName" required autoComplete="family-name" />
        </div>
        <Field label={l.emailLabel} name="email" type="email" required autoComplete="email" />
        <PasswordField label={l.createPasswordLabel} name="password" required minLength={8} autoComplete="new-password" />

        <label className="flex items-center gap-3 text-sm text-cream/85">
          <input
            type="checkbox"
            name="terms"
            className="size-5 shrink-0 appearance-none rounded border border-white/40 bg-white/[0.04] checked:border-lime checked:bg-lime checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22black%22%20stroke-width=%223%22%3E%3Cpath%20d=%22M5%2012l5%205L20%207%22/%3E%3C/svg%3E')] checked:bg-center checked:bg-no-repeat focus-visible:ring-2 focus-visible:ring-lime/50 focus-visible:outline-none"
          />
          <span>
            {l.termsPrefix}{" "}
            <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className={link}>
              {l.termsLink}
            </a>{" "}
            {l.termsJoin}{" "}
            <a href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer" className={link}>
              {l.privacyLink}
            </a>
          </span>
        </label>

        <button type="submit" disabled={busy} className={`${PRIMARY} mt-1`}>
          {busy ? l.creating : l.createAccount}
        </button>
        <Notice {...notice} />
      </form>
      <OAuthButtons providers={providers} onNotice={fail} divider={l.registerWith} />
    </>
  );
}
