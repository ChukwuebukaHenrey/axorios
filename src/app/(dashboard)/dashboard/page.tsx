import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrCreateStore } from "@/modules/brand";
import { listSellerOrders } from "@/modules/orders";

export const metadata = { title: "Orders | AxoriOS" };

const STATUS_LABEL: Record<string, string> = {
  paid: t.dashboard.statusPaid,
  approved: t.dashboard.statusConfirming,
  failed: t.dashboard.statusFailed,
};

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-900",
  approved: "bg-accent/40 text-ink",
  failed: "bg-red-100 text-red-900",
};

const CHANNEL_LABEL: Record<string, string> = {
  web: t.dashboard.channelWeb,
  telegram: t.dashboard.channelTelegram,
  whatsapp: t.dashboard.channelWhatsApp,
  instagram: t.dashboard.channelInstagram,
};

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const store = await getOrCreateStore(supabase, user.id);
  const orders = await listSellerOrders(supabase, store.id);

  return (
    <div className="min-h-dvh">
      <header className="flex items-center gap-2 bg-primary px-4 py-3 text-white">
        <Logo className="size-6" />
        <h1 className="font-semibold">{t.dashboard.title}</h1>
        <Link href="/build" className="ml-auto inline-flex min-h-11 items-center px-2 text-sm font-semibold underline">
          {t.dashboard.toBuilder}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-black/10 bg-white p-5 text-black/70">{t.dashboard.empty}</p>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div>
                    <p className="text-lg font-bold">{formatMinor(order.total_minor, order.currency)}</p>
                    {order.charge_currency !== order.currency && (
                      <p className="text-sm text-black/70">
                        {t.dashboard.charged.replace("{amount}", formatMinor(order.charge_total_minor, order.charge_currency))}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[order.status] ?? ""}`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>

                <ul className="mt-3 text-sm">
                  {order.items.map((line) => (
                    <li key={line.productId}>
                      {line.quantity} x {line.name}
                    </li>
                  ))}
                </ul>

                {order.delivery_note && (
                  <p className="mt-3 text-sm whitespace-pre-line">
                    <span className="font-semibold">{t.dashboard.delivery} </span>
                    {order.delivery_note}
                  </p>
                )}

                <p className="mt-3 text-xs text-black/60">
                  {[
                    CHANNEL_LABEL[order.channel] ?? order.channel,
                    order.customer_ref,
                    new Date(order.paid_at ?? order.created_at).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
