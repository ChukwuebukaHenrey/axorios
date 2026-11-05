"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { t } from "@/lib/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SignInForm({ linkFailed }: { linkFailed: boolean }) {
  const router = useRouter();
  const [usePassword, setUsePassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(linkFailed ? t.landing.linkFailed : "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    const supabase = createBrowserSupabase();

    if (usePassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setNotice(t.landing.signInFailed);
        setBusy(false);
        return;
      }
      router.push("/build");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setNotice(error ? t.landing.signInFailed : t.landing.magicLinkSent);
    setBusy(false);
  }

  const inputClass =
    "h-12 w-full rounded-xl border border-white/25 bg-white/10 px-4 text-base text-white placeholder:text-white/50 outline-none focus:border-accent focus:ring-2 focus:ring-accent/40";

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t.landing.emailLabel}
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      {usePassword && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t.landing.passwordLabel}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-12 rounded-xl bg-secondary font-semibold text-ink transition hover:bg-accent disabled:opacity-60"
      >
        {usePassword ? t.landing.signIn : t.landing.magicLink}
      </button>
      <button
        type="button"
        onClick={() => setUsePassword(!usePassword)}
        className="self-start text-sm underline underline-offset-4 hover:text-accent"
      >
        {usePassword ? t.landing.magicToggle : t.landing.passwordToggle}
      </button>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-accent">
        {notice}
      </p>
    </form>
  );
}
