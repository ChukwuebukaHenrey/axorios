import { FileText } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { t } from "@/lib/messages";
import { getBrandKit, listOwnerStores } from "@/modules/brand";
import { listMedia, mediaUsage } from "@/modules/media";
import { listVersions, MARKET_PRESETS, TEMPLATE_VERSIONS, type MarketPresetId } from "@/modules/storefront";
import { PageHeader } from "../../page-header";
import { requireSeller } from "../../session";
import { AskButton } from "../money/ask-button";
import { DeleteMedia, MediaUpload, TagEditor } from "./controls";

export const metadata = { title: "Design | AxoriOS" };

const d = t.app.design;
const TABS = ["media", "brand", "templates"] as const;
type Tab = (typeof TABS)[number];
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const isPreset = (id: string): id is MarketPresetId => id in MARKET_PRESETS;

function Panel({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-panel-3 bg-panel p-5">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-cream">{title}</h2>
          {note && <p className="mt-0.5 text-sm text-stone">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function DesignPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; tag?: string }> }) {
  await connection();
  const { supabase, user } = await requireSeller();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "media";
  const stores = await listOwnerStores(supabase, user.id);
  const storeName = new Map(stores.map((s) => [s.id, s.name ?? s.slug]));

  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={d.title} subtitle={d.subtitle} />
      <nav aria-label={d.title} className="-mx-1 mt-6 flex max-w-full gap-1 overflow-x-auto px-1">
        {TABS.map((tb) => (
          <Link
            key={tb}
            href={tb === "media" ? "/dashboard/design" : `/dashboard/design?tab=${tb}`}
            aria-current={tab === tb ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${tab === tb ? "bg-panel-3 font-medium text-cream" : "text-stone hover:text-cream"}`}
          >
            {d.tabs[tb]}
          </Link>
        ))}
      </nav>
      <div className="mt-5 flex flex-col gap-5">
        {tab === "media" && <MediaTab supabase={supabase} storeName={storeName} q={sp.q} tag={sp.tag} />}
        {tab === "brand" && <BrandTab stores={stores} />}
        {tab === "templates" && <TemplatesTab supabase={supabase} stores={stores} />}
      </div>
    </main>
  );
}

type Session = Awaited<ReturnType<typeof requireSeller>>["supabase"];
type Stores = Awaited<ReturnType<typeof listOwnerStores>>;

async function MediaTab({ supabase, storeName, q, tag }: { supabase: Session; storeName: Map<string, string>; q?: string; tag?: string }) {
  const m = d.media;
  const all = await listMedia(supabase);
  const usage = await mediaUsage(supabase, all);
  const tags = [...new Set(all.flatMap((i) => i.tags))].sort();
  const query = (q ?? "").trim().toLowerCase();
  const items = all
    .filter((i) => !tag || i.tags.includes(tag))
    .filter((i) => !query || i.name.toLowerCase().includes(query) || i.tags.some((x) => x.includes(query)));

  return (
    <>
      <Panel title={m.uploadTitle} note={m.uploadBody}>
        <MediaUpload />
      </Panel>
      <section className="rounded-2xl border border-panel-3 bg-panel p-5">
        <form className="flex flex-wrap items-center gap-2" action="/dashboard/design">
          <label className="sr-only" htmlFor="media-q">
            {m.search}
          </label>
          <input
            id="media-q"
            name="q"
            defaultValue={q}
            placeholder={m.search}
            className="h-9 min-w-0 flex-1 rounded-lg border border-panel-3 bg-panel-2 px-3 text-sm text-cream placeholder:text-stone/70 outline-none focus:border-cream/30 sm:max-w-xs"
          />
          <label className="sr-only" htmlFor="media-tag">
            {m.allTags}
          </label>
          <select id="media-tag" name="tag" defaultValue={tag ?? ""} className="h-9 max-w-full rounded-lg border border-panel-3 bg-panel-2 px-2 text-sm text-cream">
            <option value="">{m.allTags}</option>
            {tags.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-lg bg-panel-3 px-3 text-sm text-cream hover:bg-panel-3/70">
            {m.filter}
          </button>
          <span className="ml-auto text-sm text-stone">{m.count.replace("{count}", String(items.length))}</span>
        </form>

        {items.length === 0 ? (
          <p className="mt-6 text-sm text-stone">{all.length === 0 ? m.none : m.noMatch}</p>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const uses = usage.get(item.id) ?? [];
              return (
                <li key={item.id} data-media={item.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-panel-3 bg-panel-2">
                  <a href={item.url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-panel-3" aria-label={`${m.open} ${item.name}`}>
                    {item.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.url} alt={item.name} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-stone">
                        <FileText className="size-10" aria-hidden="true" />
                      </span>
                    )}
                  </a>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-cream" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-xs text-stone">
                        {(item.storeId && storeName.get(item.storeId)) || m.account} · {m.source[item.source as keyof typeof m.source] ?? item.source} ·{" "}
                        {day(item.createdAt)}
                      </p>
                    </div>
                    <TagEditor id={item.id} tags={item.tags} />
                    <div className="text-sm">
                      <p className="text-xs font-medium tracking-wide text-stone uppercase">{m.usedIn}</p>
                      {uses.length === 0 ? (
                        <p className="text-stone">{m.unused}</p>
                      ) : (
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {uses.map((u, i) => (
                            <li key={i} className="truncate">
                              <Link href={u.href} className="text-cream underline-offset-2 hover:underline">
                                {m.use[u.kind]}: {u.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="mt-auto flex justify-end">
                      <DeleteMedia id={item.id} name={item.name} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

async function BrandTab({ stores }: { stores: Stores }) {
  const b = d.brand;
  const kits = await Promise.all(stores.map(async (s) => ({ store: s, kit: await getBrandKit(s.id) })));
  return (
    <>
      <p className="text-sm text-stone">{b.note}</p>
      <div className="grid gap-5 lg:grid-cols-2">
        {kits.map(({ store, kit }) => (
          <Panel
            key={store.id}
            title={kit?.name ?? store.name ?? store.slug}
            note={kit?.tagline ?? b.empty}
            action={
              <AskButton
                label={kit ? b.edit : b.create}
                prompt={kit ? b.editPrompt.replace("{name}", kit.name) : b.createPrompt}
              />
            }
          >
            {kit && (
              <dl data-brand={store.slug} className="mt-4 grid gap-4 text-sm">
                <div>
                  <dt className="text-xs font-medium tracking-wide text-stone uppercase">{b.palette}</dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(kit.palette).map(([k, hex]) => (
                      <span key={k} className="flex items-center gap-2 rounded-lg border border-panel-3 py-1 pr-2 pl-1">
                        <span className="size-6 rounded-md border border-black/20" style={{ background: hex }} aria-hidden="true" />
                        <span className="font-mono text-xs text-cream">{hex}</span>
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium tracking-wide text-stone uppercase">{b.fonts}</dt>
                  <dd className="mt-1 text-cream">
                    {kit.fonts.heading} · {kit.fonts.body}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium tracking-wide text-stone uppercase">{b.tone}</dt>
                  <dd className="mt-1 text-cream/90">{kit.tone}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium tracking-wide text-stone uppercase">{b.logo}</dt>
                  <dd className="mt-1">
                    {kit.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={kit.logoUrl} alt={kit.name} className="h-14 w-auto rounded-md bg-white/5 object-contain" />
                    ) : (
                      <span className="text-stone">{b.noLogo}</span>
                    )}
                  </dd>
                </div>
                {kit.referenceImageUrls.length > 0 && (
                  <div>
                    <dt className="text-xs font-medium tracking-wide text-stone uppercase">{b.references}</dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                      {kit.referenceImageUrls.map((u) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={u} src={u} alt="" className="size-14 rounded-md object-cover" />
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}

async function TemplatesTab({ supabase, stores }: { supabase: Session; stores: Stores }) {
  const tp = d.templates;
  const { data: rows, error } = await supabase.from("stores").select("id, template_version");
  if (error) throw new Error(`Store read failed: ${error.code}`);
  const pinned = new Map(rows.map((r) => [r.id, r.template_version]));
  const onTemplate = await Promise.all(
    stores.map(async (s) => {
      const current = (await listVersions(s.id, 10)).find((v) => v.status !== "archived")?.preset ?? null;
      const preset = current && isPreset(current) ? current : null;
      return { store: s, preset, version: pinned.get(s.id) ?? (preset ? TEMPLATE_VERSIONS[preset] : null) };
    }),
  );
  return (
    <>
      <p className="text-sm text-stone">{tp.note}</p>
      <div className="grid gap-5 lg:grid-cols-2">
        {(Object.keys(MARKET_PRESETS) as MarketPresetId[]).map((id) => {
          const preset = MARKET_PRESETS[id];
          const users = onTemplate.filter((x) => x.preset === id);
          return (
            <Panel
              key={id}
              title={`${preset.label} · ${tp.version.replace("{n}", String(TEMPLATE_VERSIONS[id]))}`}
              note={id}
              action={<AskButton label={tp.switch} prompt={tp.switchPrompt.replace("{name}", preset.label)} />}
            >
              <div data-template={id} className="mt-4 grid gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium tracking-wide text-stone uppercase">{tp.sections}</p>
                  <p className="mt-1 text-cream/90">
                    {Object.entries(preset.variants)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-stone uppercase">{tp.stores}</p>
                  {users.length === 0 ? (
                    <p className="mt-1 text-stone">{tp.noStores}</p>
                  ) : (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {users.map((u) => (
                        <li key={u.store.id} className="rounded-full bg-panel-3 px-2.5 py-0.5 text-cream">
                          {u.store.name ?? u.store.slug}
                          {u.version !== null && <span className="text-stone"> · {tp.version.replace("{n}", String(u.version))}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
