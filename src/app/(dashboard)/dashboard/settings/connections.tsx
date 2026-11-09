import { AlertTriangle, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { env } from "@/lib/env";
import { t } from "@/lib/messages";
import type { ToolPermission } from "@/modules/agent/approvals";
import { allowedPermissions, toolsFor, type ConnectionId } from "@/modules/agent/permissions";
import { customerChatUrl, isChannelEnabled } from "@/modules/channels";
import { shopConnection } from "@/modules/platforms";
import { CopyLink } from "./copy-link";
import { DisconnectShopify, PermissionPicker } from "./controls";

const c = t.app.settings.connections;
const tools = t.app.settings.ai.tools as Record<string, string>;
type Status = keyof typeof c.status;

const img = (src: string) => <Image src={src} alt="" width={32} height={32} className="size-8 object-contain" />;
const action = "inline-flex h-8 items-center rounded-md border border-panel-3 bg-panel-2 px-3 text-sm text-cream transition hover:border-cream/30";
const ask = (prompt: string) => `/build?prompt=${encodeURIComponent(prompt)}`;

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Card(props: {
  id: string;
  icon: ReactNode;
  name: string;
  status: Status;
  scope: "store" | "account";
  body: string;
  data: string;
  lastUsed?: string | null;
  connection?: ConnectionId;
  permissions: Record<string, ToolPermission>;
  used: Record<string, string>;
  unused: string[];
  actions?: ReactNode;
}) {
  const { status, connection, permissions, unused } = props;
  const badge = { connected: "bg-lime/15 text-lime", sandbox: "bg-accent/15 text-accent", demo: "bg-accent/15 text-accent", reconnect: "bg-red-400/15 text-red-200", off: "bg-panel-3 text-stone", notConnected: "bg-panel-3 text-stone", linkOut: "bg-panel-3 text-stone" }[status];
  const live = status === "connected" || status === "sandbox";
  const list = connection ? toolsFor(connection) : [];
  return (
    <li id={`conn-${props.id}`} className="rounded-2xl border border-panel-3 bg-panel p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-panel-2">{props.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-base font-medium text-cream">{props.name}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${badge}`}>{c.status[status]}</span>
            <span className="rounded-full border border-panel-3 px-2.5 py-0.5 text-xs text-stone">{props.scope === "store" ? c.scopeStore : c.scopeAll}</span>
          </p>
          <p className="mt-1 text-sm text-cream/80">{props.body}</p>
          <p className="mt-2 text-xs text-stone">
            <span className="text-cream/70">{c.data}</span> {props.data}
          </p>
          {props.lastUsed !== undefined && (
            <p className="mt-1 text-xs text-stone" suppressHydrationWarning>
              {props.lastUsed ? c.lastUsed.replace("{when}", when(props.lastUsed)) : c.never}
            </p>
          )}
        </div>
        {props.actions && <div className="flex shrink-0 flex-wrap gap-2">{props.actions}</div>}
      </div>
      {list.length > 0 && (
        <div className="mt-4 border-t border-panel-3 pt-4">
          <p className="text-xs tracking-wide text-stone uppercase">{c.permissions}</p>
          <ul className="mt-2 flex flex-col gap-3">
            {list.map(({ name }) => {
              const stale = live && permissions[name] !== "blocked" && unused.includes(name);
              return (
                <li key={name} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-cream">
                    {tools[name] ?? name}
                    {stale && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-200">
                        <AlertTriangle className="size-3" aria-hidden="true" /> {c.unused}
                      </span>
                    )}
                  </span>
                  <PermissionPicker tool={name} label={tools[name] ?? name} value={permissions[name]} allowed={allowedPermissions(name)} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-sm font-medium tracking-wide text-stone uppercase">{title}</h3>
      <ul className="mt-3 flex flex-col gap-3">{children}</ul>
    </section>
  );
}

export function ConnectionsDirectory({
  store,
  permissions,
  shop,
  used,
  unused,
}: {
  store: { id: string; slug: string; status: string };
  shop: Awaited<ReturnType<typeof shopConnection>>;
  permissions: Record<string, ToolPermission>;
  used: Record<string, string>;
  unused: string[];
}) {
  const e = env();
  const isDemo = store.slug === e.DEMO_STORE_SLUG;
  const chatUrl = customerChatUrl(store.slug);
  const whatsapp = isChannelEnabled("whatsapp");
  const shopFailed = Boolean(shop?.lastResult && "error" in shop.lastResult);
  const it = c.items;
  const common = { permissions, used, unused };
  const demo = (flag: "off" | "demo"): Status => (isDemo && flag === "demo" ? "demo" : "off");

  return (
    <div>
      <p className="max-w-2xl text-sm text-cream/80">{c.body}</p>
      <div className="mt-6">
        <Group title={c.groups.sales}>
          <Card
            id="shopify"
            {...common}
            icon={<ShoppingBag className="size-7 text-[#95bf47]" aria-hidden="true" />}
            name={it.shopify.name}
            status={shop ? (shopFailed ? "reconnect" : "connected") : "notConnected"}
            scope="store"
            body={shop ? `${it.shopify.body} ${shop.shopDomain}` : it.shopify.body}
            data={it.shopify.data}
            lastUsed={shop ? (shop.lastSyncedAt ?? used.sync_to_shopify ?? null) : undefined}
            connection="shopify"
            actions={
              shop ? (
                <>
                  {shopFailed && (
                    <Link href={ask(t.app.cards.connectPrompt)} className={action}>
                      {c.reconnect}
                    </Link>
                  )}
                  <DisconnectShopify domain={shop.shopDomain} />
                </>
              ) : (
                <Link href={ask(t.app.cards.connectPrompt)} className={action}>
                  {c.connect}
                </Link>
              )
            }
          />
        </Group>

        <Group title={c.groups.messaging}>
          <Card
            id="telegram"
            {...common}
            icon={img("/images/icons/telegram.png")}
            name={it.telegram.name}
            status={chatUrl ? "connected" : "off"}
            scope="account"
            body={store.status === "live" ? it.telegram.body : `${it.telegram.body} ${it.telegram.needsPublish}`}
            data={it.telegram.data}
            actions={chatUrl && store.status === "live" ? <CopyLink url={chatUrl} /> : undefined}
          />
          <Card
            id="whatsapp"
            {...common}
            icon={img("/images/icons/whatsapp.png")}
            name={it.whatsapp.name}
            status={whatsapp ? "connected" : "off"}
            scope="account"
            body={whatsapp && e.WHATSAPP_PROVIDER === "kapso" ? it.whatsapp.body.replace("{slug}", store.slug) : it.whatsapp.bodyOff}
            data={it.whatsapp.data}
          />
        </Group>

        <Group title={c.groups.social}>
          <Card
            id="telegram-channel"
            {...common}
            icon={img("/images/icons/telegram.png")}
            name={it.telegramChannel.name}
            status={isDemo && e.TELEGRAM_CHANNEL_ID ? "connected" : "off"}
            scope="store"
            body={isDemo ? it.telegramChannel.body : it.telegramChannel.bodyOther}
            data={it.telegramChannel.data}
          />
          <Card id="meta" {...common} icon={img("/images/icons/messenger.png")} name={it.meta.name} status={demo(e.META_PROVIDER)} scope="store" body={it.meta.body} data={it.meta.data} />
          <Card id="tiktok" {...common} icon={<span className="text-xs font-semibold text-cream">TikTok</span>} name={it.tiktok.name} status={demo(e.TIKTOK_PROVIDER)} scope="store" body={it.tiktok.body} data={it.tiktok.data} />
          <Card id="google" {...common} icon={<span className="text-lg font-semibold text-[#4285f4]">G</span>} name={it.google.name} status={demo(e.GOOGLE_PROVIDER)} scope="store" body={it.google.body} data={it.google.data} />
        </Group>

        <Group title={c.groups.payments}>
          <Card
            id="paypal"
            {...common}
            icon={img("/images/icons/paypal.png")}
            name={it.paypal.name}
            status="sandbox"
            scope="account"
            body={it.paypal.body}
            data={it.paypal.data}
            lastUsed={used.refund_order ?? null}
            connection="paypal"
          />
          <Card
            id="paga"
            {...common}
            icon={<span className="text-sm font-semibold text-[#f27b21]">Paga</span>}
            name={it.paga.name}
            status="linkOut"
            scope="account"
            body={it.paga.body}
            data={it.paga.data}
            actions={
              <Link href="/dashboard/money" className={action}>
                {t.app.settings.payments.openMoney}
              </Link>
            }
          />
        </Group>

        <Group title={c.groups.apps}>
          <Card
            id="zapier"
            {...common}
            icon={<span className="text-sm font-semibold text-[#ff4f00]">Zapier</span>}
            name={it.zapier.name}
            status={e.ZAPIER_ENABLED === "true" ? "connected" : "notConnected"}
            scope="account"
            body={e.ZAPIER_ENABLED === "true" ? it.zapier.body : `${it.zapier.body} ${it.zapier.bodyOff}`}
            data={it.zapier.data}
            lastUsed={e.ZAPIER_ENABLED === "true" ? (used.zapier_action ?? null) : undefined}
            connection="zapier"
          />
        </Group>

        <Group title={c.groups.advanced}>
          <Card
            id="custom-mcp"
            {...common}
            icon={<AlertTriangle className="size-6 text-amber-200" aria-hidden="true" />}
            name={it.customMcp.name}
            status="off"
            scope="account"
            body={it.customMcp.body}
            data={it.customMcp.data}
          />
        </Group>
      </div>
    </div>
  );
}
