"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAxori } from "../../_axori/provider";

/** Opens Axori AI with a starter sentence; the tool's approval card does the rest. */
export function AskButton({ label, prompt }: { label: string; prompt: string }) {
  const { ask } = useAxori();
  return (
    <Button variant="outline" onClick={() => ask(prompt)}>
      <Sparkles aria-hidden="true" /> {label}
    </Button>
  );
}
