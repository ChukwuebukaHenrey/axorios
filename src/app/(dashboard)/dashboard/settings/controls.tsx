"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t } from "@/lib/messages";
import type { ToolPermission } from "@/modules/agent/approvals";
import { disconnectShopify, saveName, savePermission } from "./actions";

const s = t.app.settings;
const LABEL: Record<ToolPermission, string> = { always: s.ai.always, approve: s.ai.approve, blocked: s.ai.blocked };

/** Always allow / Needs approval / Blocked. Options looser than the default aren't offered. */
export function PermissionPicker({ tool, value, allowed, label }: { tool: string; value: ToolPermission; allowed: ToolPermission[]; label: string }) {
  const [current, setCurrent] = useState(value);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  function choose(next: ToolPermission) {
    if (next === current) return;
    const before = current;
    setCurrent(next);
    setFailed(false);
    start(async () => {
      const { ok } = await savePermission(tool, next).catch(() => ({ ok: false }));
      if (!ok) {
        setCurrent(before);
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-panel-3 bg-panel-2 p-0.5" data-tool={tool}>
        {(["always", "approve", "blocked"] as const).map((p) => {
          const on = current === p;
          const tone = p === "blocked" ? "bg-red-400/15 text-red-200" : p === "approve" ? "bg-accent/15 text-cream" : "bg-lime/15 text-lime";
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!allowed.includes(p) || pending}
              onClick={() => choose(p)}
              className={`rounded-md px-2.5 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-35 ${on ? tone : "text-stone hover:text-cream"}`}
            >
              {LABEL[p]}
            </button>
          );
        })}
      </div>
      {failed && <span className="text-xs text-red-300">{s.ai.failed}</span>}
    </div>
  );
}

export function NameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setSaved((await saveName(name)).ok));
      }}
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-stone">
        {s.profile.name}
        <input
          value={name}
          maxLength={80}
          onChange={(e) => (setName(e.target.value), setSaved(false))}
          placeholder={s.profile.namePlaceholder}
          className="h-10 rounded-lg border border-panel-3 bg-panel-2 px-3 text-base text-cream outline-none focus:border-cream/40"
        />
      </label>
      <Button type="submit" disabled={pending}>
        {saved ? (
          <>
            <Check aria-hidden="true" /> {s.profile.saved}
          </>
        ) : (
          s.profile.save
        )}
      </Button>
    </form>
  );
}

/** Explains the effect first, then disconnects. */
export function DisconnectShopify({ domain }: { domain: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const c = s.connections;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {c.disconnect}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-panel-3 bg-panel text-cream">
          <DialogHeader>
            <DialogTitle>{c.disconnectTitle.replace("{name}", c.items.shopify.name)}</DialogTitle>
            <DialogDescription>{c.items.shopify.disconnectEffect.replace("{domain}", domain)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {c.cancel}
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => start(async () => (await disconnectShopify(), setOpen(false)))}>
              {c.disconnect}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
