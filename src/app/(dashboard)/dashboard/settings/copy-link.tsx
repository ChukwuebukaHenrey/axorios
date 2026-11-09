"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { t } from "@/lib/messages";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-panel-3 bg-panel-2 px-3 text-sm text-cream transition hover:border-cream/30"
    >
      {copied ? <Check className="size-4 text-lime" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {copied ? t.app.integrations.copied : t.app.integrations.copyLink}
    </button>
  );
}
