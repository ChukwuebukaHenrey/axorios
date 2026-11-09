"use client";

import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import type { RefundOutcome } from "@/modules/orders";
import { approveRefundAction, previewRefundAction, type RefundPreview } from "./actions";

const r = t.app.refund;
const reasonText = (reason: string) => (r.reasons as Record<string, string>)[reason] ?? reason.replaceAll("_", " ");
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });

/** The numbers an approval rests on. Shared by the Orders card and Axori AI's refund_order card. */
export function RefundSummary({ preview }: { preview: RefundPreview | null }) {
  if (!preview)
    return (
      <p className="flex items-center gap-2 text-sm text-stone">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> {r.checking}
      </p>
    );
  if (!preview.ok)
    return (
      <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {reasonText(preview.reason)}
      </p>
    );
  const money = (minor: number) => formatMinor(minor, preview.currency);
  const rows: [string, string, string?][] = [
    [r.willRefund, money(preview.amountMinor)],
    [r.storeEquivalent.replace("{currency}", preview.storeCurrency), formatMinor(preview.storeAmountMinor, preview.storeCurrency)],
    [r.vatReversed, formatMinor(preview.vatReversedMinor, preview.storeCurrency)],
  ];
  if (preview.remainingMinor !== undefined) rows.push([r.left, money(preview.remainingMinor - preview.amountMinor)]);
  if (preview.balanceMinor !== undefined && preview.balanceMinor !== null) rows.push([r.balance, money(preview.balanceMinor), r.balanceWhole]);
  return (
    <div className="space-y-3 text-sm">
      <dl className="divide-y divide-panel-3 rounded-xl border border-panel-3 bg-panel">
        {rows.map(([label, value, note], i) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-3 py-2">
            <dt className="text-stone">
              {label}
              {note && <span className="block text-xs text-stone/70">{note}</span>}
            </dt>
            <dd className={`font-mono tabular-nums ${i === 0 ? "text-base font-semibold text-cream" : "text-cream/90"}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {preview.balanceMinor === null && <p className="text-xs text-stone">{r.balanceUnknown}</p>}
      {!!preview.shortfallMinor && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {r.shortfall.replace("{amount}", money(preview.shortfallMinor))}
        </p>
      )}
      {preview.windowEndsAt && <p className="text-xs text-stone">{r.window.replace("{date}", day(preview.windowEndsAt))}</p>}
    </div>
  );
}

/** Live preview of a refund: re-asks the server whenever the amount settles. */
export function useRefundPreview(orderId: string, amount: string | undefined, enabled = true) {
  // Keyed by what was asked, so a changed amount shows "checking" until its own answer arrives.
  const key = `${orderId}|${amount ?? ""}`;
  const [result, setResult] = useState<{ key: string; preview: RefundPreview } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const timer = setTimeout(() => {
      previewRefundAction({ orderId, amount }).then((p) => live && setResult({ key: `${orderId}|${amount ?? ""}`, preview: p }));
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [orderId, amount, enabled]);
  return result?.key === key ? result.preview : null;
}

/** Orders › Refund: an approval card. Nothing reaches PayPal until Approve. */
export function RefundButton({ orderId, chargeCurrency, disabledReason }: { orderId: string; chargeCurrency: string; disabledReason?: string }) {
  const [open, setOpen] = useState(false);
  if (disabledReason) {
    return (
      <div className="space-y-1">
        <Button variant="outline" disabled>
          <RotateCcw aria-hidden="true" /> {r.button}
        </Button>
        <p className="text-xs text-stone">{disabledReason}</p>
      </div>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RotateCcw aria-hidden="true" /> {r.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-panel-3 bg-panel-2 text-cream sm:max-w-md">{open && <RefundForm orderId={orderId} chargeCurrency={chargeCurrency} onDone={() => setOpen(false)} />}</DialogContent>
    </Dialog>
  );
}

function RefundForm({ orderId, chargeCurrency, onDone }: { orderId: string; chargeCurrency: string; onDone: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<RefundOutcome | null>(null);
  const [sending, startSending] = useTransition();
  const partialOk = /^\d+(\.\d{1,2})?$/.test(amount.trim());
  const preview = useRefundPreview(orderId, mode === "full" ? undefined : amount.trim(), mode === "full" || partialOk);
  const canApprove = !!preview?.ok && !preview.shortfallMinor && !sending && !outcome;

  const approve = () => {
    if (!preview?.ok || !preview.approvalId) return;
    const approvalId = preview.approvalId;
    startSending(async () => {
      const result = await approveRefundAction({ orderId, amount: mode === "full" ? undefined : amount.trim(), approvalId, reason });
      setOutcome(result);
      if (result.ok) router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-lime uppercase">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> {t.app.axori.approval.title}
        </p>
        <DialogTitle>{r.title}</DialogTitle>
        <DialogDescription className="text-stone">{r.feeNote}</DialogDescription>
      </DialogHeader>

      {outcome?.ok ? (
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden="true" />
            {outcome.repeated ? r.repeated : (outcome.status === "completed" ? r.done : r.pending).replace("{amount}", formatMinor(outcome.amountMinor, outcome.currency))}
          </p>
          <Button className="w-full" onClick={onDone}>
            {r.close}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div role="radiogroup" aria-label={r.title} className="grid grid-cols-2 gap-2">
            {(["full", "partial"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`h-10 rounded-lg border text-sm font-medium transition ${mode === m ? "border-lime bg-lime/10 text-lime" : "border-panel-3 text-cream/80 hover:bg-white/5"}`}
              >
                {m === "full" ? r.full : r.partial}
              </button>
            ))}
          </div>
          {mode === "partial" && (
            <label className="block text-sm">
              <span className="text-stone">{r.amount.replace("{currency}", chargeCurrency)}</span>
              <input
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10.00"
                className="mt-1 h-10 w-full rounded-lg border border-panel-3 bg-panel px-3 font-mono text-cream outline-none focus:border-lime"
              />
              {preview?.ok && preview.remainingMinor !== undefined && (
                <span className="mt-1 block text-xs text-stone">{r.amountHint.replace("{max}", formatMinor(preview.remainingMinor, preview.currency))}</span>
              )}
            </label>
          )}
          <label className="block text-sm">
            <span className="text-stone">{r.reason}</span>
            <input
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder={r.reasonPlaceholder}
              className="mt-1 h-10 w-full rounded-lg border border-panel-3 bg-panel px-3 text-cream outline-none focus:border-lime"
            />
          </label>
          {mode === "partial" && !partialOk ? <p className="text-xs text-stone">{reasonText("invalid_amount")}</p> : <RefundSummary preview={preview} />}
          {outcome && !outcome.ok && (
            <p className="flex items-start gap-2 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {reasonText(outcome.reason)}
            </p>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!canApprove} onClick={approve}>
              {sending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" /> {r.sending}
                </>
              ) : (
                r.approve
              )}
            </Button>
            <Button variant="outline" className="flex-1" onClick={onDone} disabled={sending}>
              {r.cancel}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Axori AI's refund_order card: the same numbers as Orders › Refund, approved through the chat's own approval. */
export function RefundToolSummary({ input, output, waiting }: { input: unknown; output?: unknown; waiting: boolean }) {
  const { orderId, amount } = (input ?? {}) as { orderId?: string; amount?: string };
  const preview = useRefundPreview(orderId ?? "", amount, waiting && !!orderId);
  const done = output as RefundOutcome | undefined;
  if (done && "ok" in done) {
    if (!done.ok) return <p className="text-red-300">{reasonText(done.reason)}</p>;
    return <p>{done.repeated ? r.repeated : (done.status === "completed" ? r.done : r.pending).replace("{amount}", formatMinor(done.amountMinor, done.currency))}</p>;
  }
  if (!waiting) return null;
  return (
    <>
      {orderId && (
        <p className="mb-2 font-mono text-xs text-stone">
          #{orderId.slice(0, 8)}
          {amount ? ` · ${r.partial}` : ` · ${r.full}`}
        </p>
      )}
      <RefundSummary preview={preview} />
    </>
  );
}
