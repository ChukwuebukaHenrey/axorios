import { BadgeCheck, Hourglass, MessageCircle, Mic, Paperclip, Send, Sparkles } from "lucide-react";
import { t } from "@/lib/messages";

const f = t.marketing.home.features;

/** Card 1: the agent working through a buyer conversation. */
export function AgentVisual() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-4 py-10">
      <span className="relative z-10 inline-flex items-center gap-2 rounded-lg bg-[#2d3320] px-3 py-1.5 font-display text-lg font-medium text-cream">
        <Hourglass className="size-5 text-lime" aria-hidden="true" />
        {f.agentPill}
      </span>
      <div aria-hidden="true" className="absolute top-[calc(50%-40px)] bottom-6 left-1/2 w-px bg-cream/15" />
      <ul className="relative mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {f.agentChips.map((chip) => (
          <li
            key={chip}
            className="inline-flex items-center justify-between gap-2 rounded-md bg-black/40 px-2.5 py-1.5 text-[11px] text-cream backdrop-blur-sm sm:text-xs"
          >
            {chip}
            <BadgeCheck className="size-3.5 shrink-0 fill-cream text-[#262626]" aria-hidden="true" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Rows({ rows }: { rows: string[][] }) {
  return (
    <dl className="rounded-lg bg-black/30 px-3 py-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-1 text-[11px] sm:text-xs">
          <dt className="text-stone">{k}</dt>
          <dd className="text-cream">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Card 2: voice note in, agent action out, joined by the lime connector. */
export function VoiceFlowVisual() {
  return (
    <div className="relative h-full min-h-[300px] p-4">
      <div className="w-[62%] rounded-xl bg-[#1d2216]/95 p-2.5 shadow-xl backdrop-blur-sm">
        <p className="flex items-center gap-2 px-1 pb-2 font-display text-sm text-cream">
          <Mic className="size-4" aria-hidden="true" />
          {f.voiceTitle}
        </p>
        <Rows rows={f.voiceRows} />
      </div>
      <svg aria-hidden="true" viewBox="0 0 100 60" className="absolute top-[38%] left-[34%] h-[22%] w-[26%] text-lime" preserveAspectRatio="none">
        <path d="M2 2 H50 V58 H98" fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute right-4 bottom-4 w-[58%] rounded-xl bg-[#1d2216]/95 p-2.5 shadow-xl backdrop-blur-sm">
        <p className="flex items-center gap-2 px-1 pb-2 font-display text-sm text-cream">
          <Sparkles className="size-4" aria-hidden="true" />
          {f.actionTitle}
        </p>
        <Rows rows={f.actionRows} />
      </div>
    </div>
  );
}

const BARS = [62, 74, 58, 88, 70, 66, 80, 72];

/** Card 3: a checkout quote with the store price and the PayPal charge. */
export function FxVisual() {
  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-base text-cream">{f.fxTitle}</p>
          <p className="mt-1 text-xs text-cream/80">
            {f.fxPrice} <span className="text-stone">→</span> {f.fxCharge}
          </p>
        </div>
        <div className="flex gap-3 text-[11px]">
          <span className="text-[#8fd18f]">• {f.fxLegendLocal}</span>
          <span className="text-[#a99cf0]">• {f.fxLegendCharge}</span>
        </div>
      </div>
      <div className="mt-6 flex flex-1 items-end gap-2 sm:gap-3">
        {BARS.map((h, i) => (
          <div
            key={i}
            style={{ height: `${h}%` }}
            className={`min-h-16 flex-1 rounded-sm ${i === 3 ? "bg-lime" : "bg-[#3a4130]/80"}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Card 4: plain-language edits in the builder chat. */
export function ChatVisual() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 p-5 sm:px-10">
      {f.chatBubbles.map((bubble) => (
        <p key={bubble} className="self-end rounded-lg bg-[#2d3320] px-3 py-1.5 text-xs text-cream sm:text-sm">
          {bubble}
        </p>
      ))}
      <div className="mt-3 rounded-xl bg-black/35 p-3 backdrop-blur-sm">
        <p className="min-h-14 text-sm text-stone">{f.chatPlaceholder}</p>
        <div className="flex items-center gap-2 text-cream">
          <Paperclip className="size-4" aria-hidden="true" />
          <MessageCircle className="size-4" aria-hidden="true" />
          <Mic className="ml-auto size-4" aria-hidden="true" />
          <span className="grid size-6 place-items-center rounded-full bg-lime text-black">
            <Send className="size-3" aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}

export const FEATURE_VISUALS = [AgentVisual, VoiceFlowVisual, FxVisual, ChatVisual];
