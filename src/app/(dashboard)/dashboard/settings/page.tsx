import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/messages";
import { DAILY_REQUEST_CAP, getAccountSettings, listActivity, toolUsage } from "@/modules/agent";
import { allowedPermissions, TOOL_CATALOG } from "@/modules/agent/permissions";
import { listOwnerStores } from "@/modules/brand";
import { WHATSAPP_TEMPLATES } from "@/modules/channels";
import { shopConnection } from "@/modules/platforms";
import { PageHeader } from "../../page-header";
import { requireSeller } from "../../session";
import { signOut } from "../../shell-actions";
import { signOutEverywhere } from "./actions";
import { ConnectionsDirectory } from "./connections";
import { NameForm, PermissionPicker } from "./controls";

export const metadata = { title: "Settings | AxoriOS" };

const s = t.app.settings;
const ACCOUNT = ["profile", "security", "preferences", "notifications", "ai", "privacy"] as const;
const BUSINESS = ["stores", "connections", "payments", "messages", "policies", "activity", "usage", "team"] as const;
type Section = (typeof ACCOUNT)[number] | (typeof BUSINESS)[number];
const ALL: readonly string[] = [...ACCOUNT, ...BUSINESS];

function SectionNav({ current }: { current: Section }) {
  const link = (id: Section) => (
    <Link
      key={id}
      href={`/dashboard/settings?section=${id}`}
      aria-current={current === id ? "page" : undefined}
      className={`shrink-0 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition ${current === id ? "bg-panel-3 text-cream" : "text-stone hover:text-cream"}`}
    >
      {s.sections[id]}
    </Link>
  );
  return (
    <nav aria-label={s.title} className="flex gap-1 overflow-x-auto pb-2 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible">
      <p className="hidden px-3 pt-1 pb-1 text-xs tracking-wide text-stone uppercase lg:block">{s.groupAccount}</p>
      {ACCOUNT.map(link)}
      <p className="hidden px-3 pt-4 pb-1 text-xs tracking-wide text-stone uppercase lg:block">{s.groupBusiness}</p>
      {BUSINESS.map(link)}
    </nav>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-panel-3 bg-panel p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-cream">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-sm text-cream/80">{children}</div>
    </section>
  );
}

function Later({ title, body }: { title: string; body: string }) {
  return (
    <Panel title={title}>
      <p>{body}</p>
      <p className="w-fit rounded-full border border-panel-3 px-3 py-1 text-xs text-stone">{s.later}</p>
    </Panel>
  );
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string; before?: string }> }) {
  const params = await searchParams;
  const section = (ALL.includes(params.section ?? "") ? params.section : "profile") as Section;
  const { supabase, user, store } = await requireSeller();

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={s.title} subtitle={s.subtitle} />
      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <SectionNav current={section} />
        <div className="min-w-0 flex-1">{await body(section)}</div>
      </div>
    </main>
  );

  async function body(id: Section): Promise<ReactNode> {
    switch (id) {
      case "profile": {
        const { displayName } = await getAccountSettings(supabase, user.id);
        return (
          <Panel title={s.sections.profile}>
            <p>
              <span className="text-stone">{s.profile.email}: </span>
              <span className="text-cream">{user.email}</span>
            </p>
            <NameForm initial={displayName ?? ""} />
          </Panel>
        );
      }
      case "security":
        return (
          <Panel title={s.sections.security}>
            <p>{s.security.methods}</p>
            <div className="flex flex-col gap-3 border-t border-panel-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-cream">{s.security.logOut}</p>
                <p className="text-stone">{s.security.logOutBody}</p>
              </div>
              <form action={signOut}>
                <Button type="submit" variant="outline" data-testid="settings-log-out">
                  <LogOut aria-hidden="true" /> {s.security.logOut}
                </Button>
              </form>
            </div>
            <div className="flex flex-col gap-3 border-t border-panel-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-cream">{s.security.logOutEverywhere}</p>
                <p className="text-stone">{s.security.logOutEverywhereBody}</p>
              </div>
              <form action={signOutEverywhere}>
                <Button type="submit" variant="outline">
                  {s.security.logOutEverywhere}
                </Button>
              </form>
            </div>
            <p className="text-stone">{s.security.twoFactor}</p>
          </Panel>
        );
      case "preferences":
        return <Later title={s.sections.preferences} body={s.preferences.body} />;
      case "notifications":
        return <Later title={s.sections.notifications} body={s.notifications.body} />;
      case "privacy":
        return <Later title={s.sections.privacy} body={s.privacy.body} />;
      case "policies":
        return <Later title={s.sections.policies} body={s.policies.body} />;
      case "team":
        return <Later title={s.sections.team} body={s.team.body} />;
      case "ai": {
        const { permissions } = await getAccountSettings(supabase, user.id);
        const own = TOOL_CATALOG.filter((x) => !x.connection);
        const names = s.ai.tools as Record<string, string>;
        return (
          <Panel title={s.sections.ai}>
            <p className="max-w-2xl">{s.ai.body}</p>
            <ul className="flex flex-col divide-y divide-panel-3 border-t border-panel-3">
              {own.map(({ name }) => (
                <li key={name} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-cream">{names[name] ?? name}</span>
                  <PermissionPicker tool={name} label={names[name] ?? name} value={permissions[name]} allowed={allowedPermissions(name)} />
                </li>
              ))}
            </ul>
            <p className="text-stone">
              <Link href="/dashboard/settings?section=connections" className="underline underline-offset-4 hover:text-cream">
                {s.ai.connectionTools}
              </Link>
            </p>
          </Panel>
        );
      }
      case "connections": {
        const shop = await shopConnection(store.id);
        const [{ permissions }, usage] = await Promise.all([
          getAccountSettings(supabase, user.id),
          toolUsage(supabase, user.id, { sync_to_shopify: shop?.lastSyncedAt, connect_shopify: shop?.lastSyncedAt }),
        ]);
        return <ConnectionsDirectory store={store} shop={shop} permissions={permissions} used={usage.lastUsed} unused={usage.unused} />;
      }
      case "stores": {
        const stores = await listOwnerStores(supabase, user.id);
        return (
          <Panel title={s.sections.stores}>
            <p>{s.stores.body}</p>
            <ul className="flex flex-col divide-y divide-panel-3 border-t border-panel-3">
              {stores.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="text-cream">
                    {x.name ?? s.stores.unnamed} <span className="text-stone">· {x.currency}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${x.status === "live" ? "bg-lime/15 text-lime" : "bg-panel-3 text-stone"}`}>
                      {x.status === "live" ? s.stores.live : s.stores.draft}
                    </span>
                    {x.status === "live" && (
                      <Link href={`/s/${x.slug}`} className="text-cream underline underline-offset-4">
                        {s.stores.open}
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-stone">{s.stores.archive}</p>
          </Panel>
        );
      }
      case "payments": {
        const { data } = await supabase.from("stores").select("currency, settlement_currency").eq("id", store.id).single();
        return (
          <Panel title={s.sections.payments}>
            <div>
              <p className="text-cream">{s.payments.paypal}</p>
              <p>{s.payments.paypalBody}</p>
              {data && (
                <p className="mt-1 text-stone">{s.payments.settlement.replace("{currency}", data.currency).replace("{settlement}", data.settlement_currency)}</p>
              )}
            </div>
            <div className="border-t border-panel-3 pt-4">
              <p className="text-cream">{s.payments.paga}</p>
              <p>{s.payments.pagaBody}</p>
              <Link href="/dashboard/money" className="mt-2 inline-block text-cream underline underline-offset-4">
                {s.payments.openMoney}
              </Link>
            </div>
          </Panel>
        );
      }
      case "messages": {
        const previews = t.app.inbox.templates as Record<string, string>;
        return (
          <Panel title={s.sections.messages}>
            <p className="max-w-2xl">{s.messages.body}</p>
            <ul className="flex flex-col gap-2">
              {WHATSAPP_TEMPLATES.map((x) => (
                <li key={x.name} className="rounded-lg border border-panel-3 bg-panel-2 px-3 py-2">
                  <code className="text-cream">{x.name}</code> <span className="text-stone">· {x.language}</span>
                  {previews[x.previewKey] && <p className="mt-1 text-stone">{previews[x.previewKey]}</p>}
                </li>
              ))}
            </ul>
            <p className="text-stone">{s.messages.editLater}</p>
          </Panel>
        );
      }
      case "usage": {
        const { data } = await supabase.from("stores").select("id, slug, agent_requests_today, agent_requests_date").eq("owner_id", user.id).order("created_at");
        const today = new Date().toISOString().slice(0, 10);
        const stores = await listOwnerStores(supabase, user.id);
        const name = (id: string) => stores.find((x) => x.id === id)?.name ?? s.stores.unnamed;
        return (
          <Panel title={s.sections.usage}>
            <p>{s.usage.body.replace("{cap}", String(DAILY_REQUEST_CAP))}</p>
            <ul className="flex flex-col divide-y divide-panel-3 border-t border-panel-3">
              {(data ?? []).map((x) => {
                const used = x.agent_requests_date === today ? x.agent_requests_today : 0;
                return (
                  <li key={x.id} className="flex flex-col gap-2 py-3">
                    <span className="flex justify-between text-cream">
                      <span>{name(x.id)}</span>
                      <span className="text-stone">
                        {s.usage.today}: {used} / {DAILY_REQUEST_CAP}
                      </span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-panel-3">
                      <span className="block h-full rounded-full bg-lime" style={{ width: `${Math.min(100, (used / DAILY_REQUEST_CAP) * 100)}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-stone">{s.usage.images}</p>
          </Panel>
        );
      }
      case "activity": {
        const before = params.before && !Number.isNaN(Date.parse(params.before)) ? params.before : undefined;
        const [rows, stores] = await Promise.all([listActivity(supabase, { limit: 50, before }), listOwnerStores(supabase, user.id)]);
        const storeName = (id: string | null) => (id ? (stores.find((x) => x.id === id)?.name ?? s.stores.unnamed) : "—");
        const names = s.ai.tools as Record<string, string>;
        const actors = s.activity.actors as Record<string, string>;
        return (
          <Panel title={s.sections.activity}>
            <p>{s.activity.body}</p>
            {rows.length === 0 ? (
              <p className="text-stone">{s.activity.empty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm" data-testid="activity-log">
                  <thead className="text-xs tracking-wide text-stone uppercase">
                    <tr>
                      <th className="py-2 pr-4 font-normal">{s.activity.when}</th>
                      <th className="py-2 pr-4 font-normal">{s.activity.who}</th>
                      <th className="py-2 pr-4 font-normal">{s.activity.what}</th>
                      <th className="py-2 font-normal">{s.activity.store}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-3">
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 pr-4 whitespace-nowrap text-stone">{when(r.at)}</td>
                        <td className="py-2 pr-4 text-cream">{actors[r.actor] ?? r.actor}</td>
                        <td className="py-2 pr-4 text-cream">
                          {names[r.action] ?? r.action.replaceAll("_", " ")}
                          {r.action === "set_permission" && r.target && <span className="text-stone"> · {names[r.target] ?? r.target}</span>}
                          {r.approvalId && r.actor === "axori_ai" && <span className="ml-2 text-xs text-accent">{s.activity.approved}</span>}
                        </td>
                        <td className="py-2 text-stone">{storeName(r.storeId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rows.length === 50 && (
              <Link href={`/dashboard/settings?section=activity&before=${encodeURIComponent(rows[rows.length - 1].at)}`} className="text-cream underline underline-offset-4">
                {s.activity.older}
              </Link>
            )}
          </Panel>
        );
      }
    }
  }
}
