import { t } from "@/lib/messages";
import type { BrandKit } from "@/modules/brand";

export function BrandCard({ kit }: { kit: BrandKit }) {
  const colours = Object.entries(kit.palette);

  return (
    <article className="overflow-hidden rounded-2xl border border-panel-3 bg-panel-2 text-cream">
      <div className="p-5" style={{ background: kit.palette.primary, color: kit.palette.neutralLight }}>
        <p className="text-xs font-medium tracking-wide uppercase opacity-80">{t.brandCard.title}</p>
        <h3 className="mt-1 text-2xl font-bold">{kit.name}</h3>
        <p className="mt-1 text-sm opacity-90">{kit.tagline}</p>
      </div>
      <dl className="flex flex-col gap-4 p-5 text-sm">
        <div>
          <dt className="font-semibold">{t.brandCard.palette}</dt>
          <dd className="mt-2 flex gap-2">
            {colours.map(([role, value]) => (
              <span
                key={role}
                title={`${role}: ${value}`}
                className="size-9 rounded-lg border border-panel-3"
                style={{ background: value }}
              />
            ))}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">{t.brandCard.fonts}</dt>
          <dd className="mt-1 text-stone">
            {kit.fonts.heading} / {kit.fonts.body}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">{t.brandCard.tone}</dt>
          <dd className="mt-1 text-stone">{kit.tone}</dd>
        </div>
        {kit.nameOptions.length > 0 && (
          <div>
            <dt className="font-semibold">{t.brandCard.nameOptions}</dt>
            <dd className="mt-1 text-stone">{kit.nameOptions.join(", ")}</dd>
          </div>
        )}
      </dl>
      <p className="border-t border-panel-3 px-5 py-3 text-xs text-stone">{t.brandCard.editHint}</p>
    </article>
  );
}
