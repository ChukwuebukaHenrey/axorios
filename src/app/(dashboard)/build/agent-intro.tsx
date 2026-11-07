import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";

const b = t.app.build;

/** The agent interface reference's empty state: the agent, what it does, and a few ways to start. */
export function AgentIntro({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 py-8 text-center">
      <div className="relative grid size-28 place-items-center">
        <div aria-hidden="true" className="absolute inset-0 rounded-full bg-lime/20 blur-2xl" />
        <span className="relative grid size-24 place-items-center rounded-3xl border border-panel-3 bg-panel-2 shadow-xl">
          <Logo className="size-14" />
        </span>
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-cream">{b.agentName}</h2>
      <p className="mt-2 max-w-sm text-base leading-relaxed text-stone">{b.agentIntro}</p>
      <p className="mt-4 rounded-lg border border-panel-3 bg-panel-2 px-3 py-1.5 text-xs text-stone">{b.agentMeta}</p>
      <ul className="mt-8 flex w-full max-w-md flex-col gap-2">
        {b.suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="w-full rounded-xl border border-panel-3 bg-panel-2 px-4 py-3 text-left text-sm text-cream transition hover:border-lime/40"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
