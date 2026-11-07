"use client";

import { LayoutTemplate, Mic, Network, Plus, SendHorizontal, Square, Store, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { t } from "@/lib/messages";

const b = t.app.build;

/**
 * The chatbox reference: a raised card with the text area on top and a tool row beneath
 * (quick actions, integrations, mic, send), then context chips for the store and template.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  busy,
  recording,
  onMic,
  storeSlug,
  template,
  selectedSection,
  onClearSection,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  recording: boolean;
  onMic: () => void;
  storeSlug: string;
  template: string | null;
  selectedSection: string | null;
  onClearSection: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // Grows with the text up to a few lines, then scrolls.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  function quick(prompt: string) {
    onChange(prompt);
    setMenu(false);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(prompt.length, prompt.length);
    });
  }

  const tool = "grid size-10 place-items-center rounded-lg border border-panel-3 text-cream/80 transition hover:border-cream/30 hover:text-cream";

  return (
    <div className="rounded-2xl border border-panel-3 bg-[#141414] p-1.5 shadow-2xl shadow-black/40">
      <form onSubmit={submit} className="rounded-xl border border-panel-3 bg-panel-2 px-4 pt-4 pb-3">
        <label className="sr-only" htmlFor="builder-input">
          {b.placeholder}
        </label>
        <textarea
          id="builder-input"
          ref={area}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={b.placeholder}
          className="block max-h-40 w-full resize-none bg-transparent text-base text-cream placeholder:text-stone outline-none"
        />
        <div className="mt-4 flex items-center gap-2">
          <div className="relative">
            <button type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label={b.quick} title={b.quick} className={tool}>
              <Plus className="size-5" aria-hidden="true" />
            </button>
            {menu && (
              <ul className="absolute bottom-12 left-0 z-30 w-60 rounded-xl border border-panel-3 bg-panel-2 p-1.5 shadow-2xl">
                {b.quickActions.map((action) => (
                  <li key={action.label}>
                    <button type="button" onClick={() => quick(action.prompt)} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-cream hover:bg-panel-3">
                      {action.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/dashboard/integrations" aria-label={b.integrations} title={b.integrations} className={tool}>
            <Network className="size-5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={onMic}
            disabled={busy && !recording}
            aria-label={recording ? t.builder.micStop : t.builder.micStart}
            aria-pressed={recording}
            className={`ml-auto grid size-10 place-items-center rounded-lg transition disabled:opacity-40 ${
              recording ? "animate-pulse bg-red-600 text-white" : "text-cream/80 hover:text-cream"
            }`}
          >
            {recording ? <Square className="size-4" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
          </button>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            aria-label={b.send}
            className="grid size-10 place-items-center rounded-lg bg-lime text-black transition hover:bg-lime/85 disabled:opacity-40"
          >
            <SendHorizontal className="size-4" aria-hidden="true" />
          </button>
        </div>
      </form>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm text-stone">
        <span className="flex items-center gap-1.5">
          <Store className="size-4" aria-hidden="true" /> {b.storeChip}: {storeSlug}
        </span>
        {template && (
          <span className="flex items-center gap-1.5">
            <LayoutTemplate className="size-4" aria-hidden="true" /> {b.templateChip}: {template}
          </span>
        )}
        {selectedSection && (
          <span className="flex items-center gap-1 rounded-md bg-[#2b3118] py-0.5 pr-1 pl-2 text-lime">
            {t.builder.editing} {selectedSection}
            <button type="button" onClick={onClearSection} aria-label={t.builder.clearSelection} className="grid size-5 place-items-center rounded hover:bg-black/30">
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
