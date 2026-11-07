import { t } from "@/lib/messages";
import { FEATURE_VISUALS } from "./feature-visuals";
import { CONTAINER, InnerPanel, Panel, SECTION, SectionHeading } from "./ui";

const f = t.marketing.home.features;

/** "All-in-one" 2×2: each card is a visual in an inset panel, then title and body. */
export function FeaturesGrid() {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={f.eyebrow} title={f.title} subhead={f.subhead} />
        <ul className="mt-16 grid gap-5 md:grid-cols-2">
          {f.cards.map((card, i) => {
            const Visual = FEATURE_VISUALS[i];
            return (
              <li key={card.title}>
                <Panel className="h-full">
                  <InnerPanel className="h-[300px] overflow-hidden sm:h-[300px]">
                    <Visual />
                  </InnerPanel>
                  <div className="px-4 pt-8 pb-6 sm:px-6">
                    <h3 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.02em] text-cream">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-stone sm:text-lg">{card.body}</p>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
