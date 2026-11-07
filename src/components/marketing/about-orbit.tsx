import { ArrowRight, ArrowUpRight, Bot } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";
import { CONTAINER, Eyebrow } from "./ui";

const a = t.marketing.home.about;

function CaptionCard({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-[356px] rounded-[10px] bg-panel p-1 shadow-2xl shadow-black/40">
      <div className="rounded-lg bg-panel-2 p-3">{children}</div>
      <div className="px-2 pt-2 pb-3">
        <p className="font-display text-lg font-semibold text-cream">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-stone">{body}</p>
      </div>
    </div>
  );
}

/** About section: copy, then the lime "orbit" with three product cards placed around it. */
export function AboutOrbit() {
  return (
    <section className="overflow-hidden pt-20 pb-20 sm:pt-28 lg:pt-[120px] lg:pb-0">
      <div className={CONTAINER}>
        <div className="mx-auto max-w-[766px] text-center">
          <Eyebrow>{a.eyebrow}</Eyebrow>
          <h2 className="mt-5 font-display text-[clamp(2.25rem,5vw,4rem)] leading-none font-semibold tracking-[-0.035em] text-cream">
            {a.title}
          </h2>
          <p className="mx-auto mt-5 max-w-[648px] font-display text-lg text-cream sm:text-xl">{a.lead}</p>
          <p className="mt-16 font-display text-lg leading-relaxed text-cream sm:text-2xl">{a.body}</p>
        </div>

        <div className="relative mx-auto mt-16 max-w-[1160px] sm:mt-24 lg:h-[960px]">
          {/* The orbit: grainy lime disc, two thin rings, guide lines and the brand tile at the centre. */}
          <div aria-hidden="true" className="absolute top-0 left-1/2 hidden aspect-square w-[1040px] -translate-x-1/2 lg:block">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,#e3ff48_62%,#c9ee2c_78%,#4c8a14_92%,transparent_100%)]" />
            <div className="grain absolute inset-0 rounded-full opacity-80" />
            <div className="absolute inset-[16%] rounded-full border border-white/70" />
            <div className="absolute inset-[32%] rounded-full border border-white/40" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/50" />
            <div className="absolute inset-y-0 left-[20%] border-l border-dashed border-white/80" />
            <div className="absolute inset-y-0 right-[20%] border-r border-dashed border-white/80" />
            <div className="absolute top-1/2 left-1/2 grid size-[96px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl bg-white shadow-lg">
              <Logo className="size-12" />
            </div>
          </div>

          <div className="relative grid gap-6 sm:grid-cols-2 lg:block">
            <div className="lg:absolute lg:top-[92px] lg:left-1/2 lg:-translate-x-1/2 sm:col-span-2 sm:justify-self-center">
              <CaptionCard title={a.approvalCardTitle} body={a.approvalCardBody}>
                <div className="flex items-center justify-between">
                  <p className="font-display text-xl text-cream">{a.approvalTitle}</p>
                  <span className="grid size-8 place-items-center rounded-md bg-[#26301a] font-mono text-xs text-[#8fd18f]">
                    {a.approvals.length}
                  </span>
                </div>
                <ul className="mt-3 divide-y divide-panel-3">
                  {a.approvals.map((item) => (
                    <li key={item.title} className="flex gap-3 py-2">
                      <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-[#f0b860]" aria-hidden="true" />
                      <div>
                        <p className="text-[13px] text-cream">{item.title}</p>
                        <p className="text-[10px] text-stone">{item.meta}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CaptionCard>
            </div>

            <div className="lg:absolute lg:top-[542px] lg:left-0">
              <CaptionCard title={a.flowCardTitle} body={a.flowCardBody}>
                <div className="flex items-center justify-between gap-2 rounded-md bg-panel-3/60 p-3">
                  {a.flowSteps.map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <span className="rounded-md bg-[#1b2116] px-3 py-1.5 text-[11px] text-stone">{step}</span>
                      {i < a.flowSteps.length - 1 && <ArrowRight className="size-3 text-lime" aria-hidden="true" />}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-cream">{a.flowTitle}</p>
                <p className="mt-1 text-[11px] text-stone">{a.flowBody}</p>
                <p className="mt-3 text-[10px] text-[#8fd18f]">{a.flowMeta}</p>
              </CaptionCard>
            </div>

            <div className="lg:absolute lg:top-[542px] lg:right-0">
              <CaptionCard title={a.agentCardTitle} body={a.agentCardBody}>
                <div className="flex items-center justify-between rounded-lg border border-panel-3 p-1.5">
                  <span className="grid size-10 place-items-center rounded-md bg-panel-3 text-stone">
                    <Bot className="size-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-md bg-[#1b2116] px-3 py-2 text-xs text-[#8fd18f]">• {a.agentStatus}</span>
                </div>
                <p className="mt-4 font-display text-xl text-cream">{a.agentTitle}</p>
                <p className="mt-1 text-sm text-stone">{a.agentBody}</p>
              </CaptionCard>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
