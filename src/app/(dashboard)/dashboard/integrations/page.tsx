import { ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@/lib/messages";
import { customerChatUrl, isChannelEnabled } from "@/modules/channels";
import { shopConnection } from "@/modules/platforms";
import { PageHeader } from "../../page-header";
import { requireSeller } from "../../session";
import { CopyLink } from "./copy-link";

export const metadata = { title: "Integrations | AxoriOS" };

const g = t.app.integrations;
const c = t.app.cards;
const ask = (prompt: string) => `/build?prompt=${encodeURIComponent(prompt)}`;

function Row({ icon, title, status, tone, body, children }: { icon: ReactNode; title: string; status: string; tone: "on" | "info" | "off"; body: string; children?: ReactNode }) {
  const badge = { on: "bg-lime/15 text-lime", info: "bg-accent/15 text-accent", off: "bg-panel-3 text-stone" }[tone];
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-panel-3 bg-panel p-5 sm:flex-row sm:items-center">
      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-panel-2">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-medium text-cream">{title}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${badge}`}>• {status}</span>
        </p>
        <p className="mt-1 text-sm text-stone">{body}</p>
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </li>
  );
}

const icon = (src: string) => <Image src={src} alt="" width={36} height={36} className="size-9 object-contain" />;
const action = "inline-flex h-10 items-center rounded-lg border border-panel-3 bg-panel-2 px-3 text-sm text-cream transition hover:border-cream/30";

export default async function IntegrationsPage() {
  const { store } = await requireSeller();
  const shop = await shopConnection(store.id);
  const live = store.status === "live";
  const chatUrl = customerChatUrl(store.slug);
  const whatsapp = isChannelEnabled("whatsapp");

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={g.title} subtitle={g.subtitle} />
      <ul className="mt-6 flex flex-col gap-3">
        <Row icon={icon("/images/icons/paypal.png")} title={g.paypal} status={g.sandbox} tone="info" body={g.paypalBody} />
        <Row
          icon={icon("/images/icons/telegram.png")}
          title={g.telegram}
          status={chatUrl ? g.connected : g.off}
          tone={chatUrl ? "on" : "off"}
          body={live ? g.telegramBody : g.needsPublish}
        >
          {chatUrl && live && <CopyLink url={chatUrl} />}
        </Row>
        <Row
          icon={<ShoppingBag className="size-8 text-[#95bf47]" aria-hidden="true" />}
          title={g.shopify}
          status={shop ? g.connected : g.notConnected}
          tone={shop ? "on" : "off"}
          body={shop ? c.syncedTo.replace("{domain}", shop.shopDomain) : g.shopifyBody}
        >
          <Link href={ask(shop ? c.syncPrompt : c.connectPrompt)} className={action}>
            {shop ? g.askSync : g.askConnect}
          </Link>
        </Row>
        <Row icon={icon("/images/icons/whatsapp.png")} title={g.whatsapp} status={whatsapp ? g.connected : g.off} tone={whatsapp ? "on" : "off"} body={g.whatsappBody} />
      </ul>
    </main>
  );
}
