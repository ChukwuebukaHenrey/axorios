import { Check, X } from "lucide-react";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { CtaBanner, SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { Button, CONTAINER, SectionHeading } from "@/components/marketing/ui";
import { t } from "@/lib/messages";

export const metadata = { title: "Pricing | AxoriOS" };

const p = t.marketing.pricing;
const ISSUES_URL = "https://github.com/ChukwuebukaHenrey/axorios/issues";
const COLS = "grid grid-cols-[1.4fr_1fr_1fr_1fr] md:grid-cols-[2fr_1fr_1fr_1fr]";

function Cell({ value, featured }: { value: string; featured: boolean }) {
  const content =
    value === "yes" ? (
      <Check className="mx-auto size-5" aria-label="Included" />
    ) : value === "no" ? (
      <X className="mx-auto size-5" aria-label="Not included" />
    ) : (
      value
    );
  return <div className={`flex items-center justify-center px-2 py-4 text-center text-sm sm:text-base ${featured ? "bg-[#232323]" : ""}`}>{content}</div>;
}

export default function PricingPage() {
  const c = p.comparison;
  return (
    <main className="bg-black font-display text-cream">
      <SiteNav theme="dark" />
      <PricingCards className="pt-10 pb-20 sm:pt-16 sm:pb-28 lg:pb-[120px]" />

      <section className="pb-20 sm:pb-28 lg:pb-[120px]">
        <div className={CONTAINER}>
          <SectionHeading eyebrow={c.eyebrow} title={c.title} subhead={c.subhead} />

          <div className="mt-16 overflow-x-auto">
            <div className="min-w-[680px]">
              <div className={`${COLS} overflow-hidden rounded-3xl bg-[#141414]`}>
                <div className="p-5">
                  <p className="font-display text-[28px] font-medium text-cream">{t.marketing.nav.pricing}</p>
                  <p className="mt-3 text-sm leading-relaxed text-stone">{c.intro}</p>
                </div>
                {p.plans.map((plan, i) => (
                  <div key={plan.name} className={`flex flex-col items-center p-5 text-center ${i === 1 ? "bg-[#232323]" : ""}`}>
                    <p className="font-display text-[28px] font-medium text-cream">{plan.name}</p>
                    <p className="mt-3 font-display text-4xl font-medium text-cream">
                      {plan.priceHosted}
                      {plan.periodHosted && <span className="ml-1 text-sm text-stone">{plan.periodHosted}</span>}
                    </p>
                    <Button
                      href={i === 2 ? ISSUES_URL : "/sign-up"}
                      external={i === 2}
                      variant={i === 1 ? "lime" : "muted"}
                      className="mt-5 w-full px-2"
                    >
                      {plan.cta}
                    </Button>
                  </div>
                ))}
              </div>

              {c.groups.map((group) => (
                <div key={group.title} className="mt-16">
                  <h3 className="font-display text-4xl font-medium text-cream">{group.title}</h3>
                  <div className="mt-6 overflow-hidden rounded-3xl bg-[#141414]">
                    {group.rows.map(([label, ...values]) => (
                      <div key={label} className={`${COLS} border-t border-panel-3 first:border-t-0`}>
                        <div className="flex items-center px-5 py-4 text-sm text-cream/85 sm:text-base">{label}</div>
                        {values.map((value, i) => (
                          <Cell key={i} value={value} featured={i === 1} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CtaBanner />
      <SiteFooter />
    </main>
  );
}
