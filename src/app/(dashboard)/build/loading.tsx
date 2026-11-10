import { t } from "@/lib/messages";
import { Bone } from "../page-header";

/** Builder: title, then the chat column beside the store preview. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label={t.app.loadingPage} className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6 lg:px-8">
      <div className="shrink-0">
        <div className="flex h-[1.25em] items-center text-[clamp(1.6rem,2.6vw,2.25rem)] leading-tight">
          <Bone className="h-[0.8em] w-56" />
        </div>
        <div className="mt-1 hidden h-6 items-center sm:flex">
          <Bone className="h-4 w-full max-w-md" />
        </div>
      </div>
      <div className="mt-4 h-11 shrink-0 animate-pulse rounded-xl border border-panel-3 bg-panel lg:hidden" />
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 lg:mt-6 lg:grid-cols-[minmax(360px,460px)_minmax(0,1fr)] xl:grid-cols-[minmax(400px,480px)_minmax(0,1fr)]">
        <section className="flex min-h-0 animate-pulse flex-col rounded-2xl border border-panel-3 bg-panel">
          <div className="flex flex-1 flex-col gap-6 p-5">
            <div className="flex items-center gap-2.5">
              <Bone className="size-9 rounded-lg" />
              <Bone className="h-4 w-24" />
            </div>
            <div className="space-y-2 pl-11.5">
              <Bone className="h-3.5 w-full" />
              <Bone className="h-3.5 w-4/5" />
              <Bone className="h-3.5 w-2/3" />
            </div>
          </div>
          <div className="border-t border-panel-3 p-4">
            <Bone className="h-12 w-full rounded-xl" />
          </div>
        </section>
        <section className="hidden min-h-0 animate-pulse flex-col rounded-2xl border border-panel-3 bg-panel lg:flex">
          <div className="flex items-center gap-1.5 border-b border-panel-3 px-4 py-3">
            <Bone className="mr-auto h-5 w-32" />
            <Bone className="size-8" />
            <Bone className="size-8" />
          </div>
          <div className="m-4 flex-1 rounded-lg bg-ink" />
        </section>
      </div>
    </div>
  );
}
