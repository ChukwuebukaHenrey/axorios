"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white print:hidden">
      <Printer className="size-4" aria-hidden="true" /> {label}
    </button>
  );
}
