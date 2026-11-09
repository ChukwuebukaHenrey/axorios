"use client";

import { Pencil } from "lucide-react";
import { useAxori } from "../../_axori/provider";

/** Per-group "Edit": opens Axori AI on this part of the store's context, so the change goes through an approval. */
export function ContextEdit({ label, prompt }: { label: string; prompt: string }) {
  const { ask } = useAxori();
  return (
    <button
      type="button"
      onClick={() => ask(prompt)}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-panel-3 px-2.5 text-xs text-cream/80 transition-colors hover:border-cream/20 hover:bg-panel-2 hover:text-cream active:scale-[0.98]"
    >
      <Pencil className="size-3" aria-hidden="true" /> {label}
    </button>
  );
}
