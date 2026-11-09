"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/messages";
import type { ExportOutcome, ExportPreview } from "@/modules/connections";
// Pure file: safe in the browser (the module index also exports server code).
import { EXPORT_FIELDS, type ConnectionErrorCode } from "@/modules/connections/export-orders";
import { previewZapierExportAction } from "./actions";

const z = t.app.zapier;

export function zapierErrorText(code: ConnectionErrorCode, fields: readonly string[] = EXPORT_FIELDS): string {
  return (z.errors[code] ?? z.errors.zapier_failed).replace("{fields}", fields.join(", "));
}

/** Rows of the Zapier approval card (spec v2: app, action, destination, fields sent), then the result. */
export function ZapierSummary({ input, output, waiting }: { input: unknown; output?: unknown; waiting: boolean }) {
  const key = JSON.stringify(input ?? {});
  const [preview, setPreview] = useState<{ key: string; value: ExportPreview } | null>(null);
  useEffect(() => {
    if (!waiting) return;
    let live = true;
    previewZapierExportAction(JSON.parse(key)).then((value) => live && setPreview({ key, value }));
    return () => {
      live = false;
    };
  }, [key, waiting]);

  const done = output as ExportOutcome | undefined;
  if (done && Array.isArray(done.sent)) {
    return (
      <div className="space-y-1">
        {done.sent.length > 0 && <p>{z.sent.replace("{count}", String(done.sent.length)).replace("{destination}", done.destination ?? "")}</p>}
        {done.skipped.length > 0 && <p className="text-stone">{z.skipped.replace("{count}", String(done.skipped.length))}</p>}
        {done.error && <p className="text-red-300">{zapierErrorText(done.error)}</p>}
        {done.notSent.length > 0 && <p className="text-stone">{z.notSent.replace("{orders}", done.notSent.join(", "))}</p>}
        {!done.error && done.sent.length === 0 && done.skipped.length === 0 && <p className="text-stone">{z.none}</p>}
      </div>
    );
  }
  if (!waiting) return null;
  const p = preview?.key === key ? preview.value : null;
  if (!p) return <p className="text-stone">{z.checking}</p>;
  if (!p.ok) return <p className="text-red-300">{zapierErrorText(p.error)}</p>;
  const fresh = p.orders.filter((o) => !o.alreadySent);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
      <dt className="text-stone">{z.app}</dt>
      <dd>{z.appValue}</dd>
      <dt className="text-stone">{z.action}</dt>
      <dd>{z.actionValue}</dd>
      <dt className="text-stone">{z.destination}</dt>
      <dd className="[overflow-wrap:anywhere]">{p.destination}</dd>
      <dt className="text-stone">{z.fields}</dt>
      <dd>{p.fields.join(", ")}</dd>
      <dt className="text-stone">{z.orders}</dt>
      <dd>
        {p.orders.length === 0 || fresh.length === 0 ? (
          <span className="text-stone">{z.none}</span>
        ) : (
          <ul className="space-y-0.5 font-mono text-xs">
            {p.orders.map((o) => (
              <li key={o.id} className={o.alreadySent ? "text-stone line-through" : undefined}>
                #{o.id} · {o.date} · {o.total} {o.currency}
                {o.alreadySent && <span className="ml-1 font-sans no-underline">({z.already})</span>}
              </li>
            ))}
          </ul>
        )}
      </dd>
      {fresh.length > 0 && <dd className="col-span-2 text-xs text-stone">{z.tasks.replace("{tasks}", String(p.tasks))}</dd>}
    </dl>
  );
}
