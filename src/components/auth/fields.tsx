"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useState, type ComponentProps } from "react";
import { t } from "@/lib/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const l = t.landing;

export const INPUT =
  "h-12 w-full rounded-lg border border-transparent bg-panel-3 px-4 text-base text-cream placeholder:text-stone outline-none transition hover:bg-[#303030] focus:border-cream/70 focus:bg-[#303030]";

export const PRIMARY =
  "h-12 w-full rounded-lg bg-lime text-base font-semibold text-black transition hover:bg-lime/85 disabled:opacity-60";

/** The label is visually hidden: the reference shows placeholder-style fields. */
export function Field({ label, ...input }: { label: string } & ComponentProps<"input">) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input placeholder={label} className={INPUT} {...input} />
    </label>
  );
}

export function PasswordField({ label, ...input }: { label: string } & ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <input type={visible ? "text" : "password"} placeholder={label} className={`${INPUT} pr-14`} {...input} />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? l.hidePassword : l.showPassword}
        aria-pressed={visible}
        className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-stone hover:text-cream"
      >
        {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </label>
  );
}

export function Notice({ text, error }: { text: string; error: boolean }) {
  return (
    <p role="status" aria-live="polite" className={`text-sm ${error ? "text-red-300" : "text-lime"}`}>
      {text}
    </p>
  );
}

export type Providers = { google: boolean; apple: boolean };

/**
 * Google and Apple sign-in. Each button reads whether the provider is switched on in Supabase,
 * so it works as soon as it's enabled there and says so plainly until then.
 */
export function OAuthButtons({
  providers,
  onNotice,
  divider = l.orContinue,
}: {
  providers: Providers;
  onNotice: (text: string) => void;
  divider?: string;
}) {
  async function start(provider: keyof Providers, name: string) {
    if (!providers[provider]) {
      onNotice(l.providerOff.replace("{provider}", name));
      return;
    }
    const { error } = await createBrowserSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) onNotice(l.providerFailed.replace("{provider}", name));
  }

  const button =
    "flex h-12 items-center justify-center gap-2.5 rounded-lg border border-cream/30 text-base text-cream transition hover:bg-white/[0.06]";

  return (
    <>
      <div className="my-6 flex items-center gap-4 text-sm text-stone">
        <span className="h-px flex-1 bg-cream/25" />
        {divider}
        <span className="h-px flex-1 bg-cream/25" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => start("google", l.google)} className={button}>
          <Image src="/images/auth/google.svg" alt="" width={26} height={26} className="size-5" />
          {l.google}
        </button>
        <button type="button" onClick={() => start("apple", l.apple)} className={button}>
          <Image src="/images/auth/apple.svg" alt="" width={24} height={24} className="size-5 invert" />
          {l.apple}
        </button>
      </div>
    </>
  );
}
