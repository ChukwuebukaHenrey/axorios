"use client";

import { Check, Merge, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addLabel,
  editLabel,
  merge,
  removeContact,
  removeLabel,
  toggleLabel,
  type ActionResult,
} from "./actions";

export const LABEL_COLOURS = [
  "#85D6A6",
  "#E3FF48",
  "#F97316",
  "#60A5FA",
  "#FBBF24",
  "#C084FC",
  "#F472B6",
  "#2DD4BF",
];

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{
    error: string;
    detail?: string[];
  } | null>(null);
  const act = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setError(null);
        after?.();
        router.refresh();
      } else setError({ error: r.error, detail: r.detail });
    });
  return { pending, error, act, setError };
}

function ErrorNote({
  error,
}: {
  error: { error: string; detail?: string[] } | null;
}) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
    >
      {error.error}
      {error.detail?.length ? (
        <span className="block text-red-200/80">{error.detail.join(", ")}</span>
      ) : null}
    </p>
  );
}

function Swatches({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (c: string) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex gap-1.5">
      {LABEL_COLOURS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c.toLowerCase()}
          aria-label={c}
          onClick={() => onChange(c)}
          className="flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-panel focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none"
          style={{ background: c }}
        >
          {value.toLowerCase() === c.toLowerCase() && (
            <Check className="size-3.5 text-ink" aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );
}

export function NewLabel({
  t,
}: {
  t: { name: string; colour: string; add: string };
}) {
  const [name, setName] = useState("");
  const [colour, setColour] = useState(LABEL_COLOURS[0]);
  const { pending, error, act } = useAct();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        act(
          () => addLabel(name, colour),
          () => setName(""),
        );
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <label className="sr-only" htmlFor="new-label">
        {t.name}
      </label>
      <input
        id="new-label"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.name}
        maxLength={40}
        className="h-9 w-48 rounded-md border border-input bg-input/30 px-3 text-sm text-cream placeholder:text-stone focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none"
      />
      <Swatches value={colour} onChange={setColour} name={t.colour} />
      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        <Plus aria-hidden="true" /> {t.add}
      </Button>
      <div className="basis-full">
        <ErrorNote error={error} />
      </div>
    </form>
  );
}

export function LabelRow({
  label,
  count,
  t,
}: {
  label: { id: string; name: string; colour: string };
  count: number;
  t: {
    save: string;
    del: string;
    used: string;
    colour: string;
    confirm: string;
    cancel: string;
    contacts: string;
  };
}) {
  const [name, setName] = useState(label.name);
  const [colour, setColour] = useState(label.colour);
  const [confirm, setConfirm] = useState(false);
  const { pending, error, act } = useAct();
  const dirty =
    name.trim() !== label.name ||
    colour.toLowerCase() !== label.colour.toLowerCase();
  return (
    <li data-label={label.name} className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="size-3 rounded-full"
          style={{ background: colour }}
          aria-hidden="true"
        />
        <input
          aria-label={label.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className="h-8 w-44 rounded-md border border-transparent bg-transparent px-2 text-sm text-cream hover:border-input focus-visible:border-input focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none"
        />
        <Swatches value={colour} onChange={setColour} name={t.colour} />
        <span className="text-xs text-stone">
          {t.contacts.replace("{count}", String(count))}
        </span>
        <span className="ml-auto flex gap-2">
          {dirty && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => act(() => editLabel(label.id, { name, colour }))}
            >
              {t.save}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setConfirm(true)}
            aria-label={`${t.del} ${label.name}`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </span>
      </div>
      <ErrorNote error={error} />
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="border-panel-3 bg-panel text-cream">
          <DialogHeader>
            <DialogTitle>
              {t.del} “{label.name}”
            </DialogTitle>
            <DialogDescription>{t.confirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="text-cream"
              onClick={() => setConfirm(false)}
            >
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                act(
                  () => removeLabel(label.id),
                  () => setConfirm(false),
                )
              }
            >
              {t.del}
            </Button>
          </DialogFooter>
          <ErrorNote error={error} />
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function ContactLabels({
  contactId,
  labels,
  on,
}: {
  contactId: string;
  labels: { id: string; name: string; colour: string }[];
  on: string[];
}) {
  const { pending, error, act } = useAct();
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {labels.map((l) => {
          const active = on.includes(l.id);
          return (
            <li key={l.id}>
              <button
                type="button"
                aria-pressed={active}
                disabled={pending}
                onClick={() => act(() => toggleLabel(contactId, l.id, !active))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${active ? "border-transparent text-ink" : "border-panel-3 text-cream/80 hover:border-cream/40"}`}
                style={active ? { background: l.colour } : undefined}
              >
                {!active && (
                  <span
                    className="size-2 rounded-full"
                    style={{ background: l.colour }}
                    aria-hidden="true"
                  />
                )}
                {l.name}
              </button>
            </li>
          );
        })}
      </ul>
      <ErrorNote error={error} />
    </div>
  );
}

export function MergeButton({
  keepId,
  mergeId,
  label,
}: {
  keepId: string;
  mergeId: string;
  label: string;
}) {
  const { pending, error, act } = useAct();
  return (
    <span>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => act(() => merge(keepId, mergeId))}
      >
        <Merge aria-hidden="true" /> {label}
      </Button>
      <ErrorNote error={error} />
    </span>
  );
}

export function DeleteContact({
  contactId,
  t,
}: {
  contactId: string;
  t: { del: string; confirm: string; cancel: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, error, act } = useAct();
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" /> {t.del}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-panel-3 bg-panel text-cream">
          <DialogHeader>
            <DialogTitle>{t.del}</DialogTitle>
            <DialogDescription>{t.confirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="text-cream"
              onClick={() => setOpen(false)}
            >
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                act(
                  () => removeContact(contactId),
                  () => router.push("/dashboard/customers"),
                )
              }
            >
              {t.del}
            </Button>
          </DialogFooter>
          <ErrorNote error={error} />
        </DialogContent>
      </Dialog>
    </>
  );
}
