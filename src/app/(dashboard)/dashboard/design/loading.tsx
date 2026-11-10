import { Bone, PageHeaderSkeleton, PageSkeleton, PanelSkeleton, SegmentedSkeleton } from "../../page-header";

/** Design media: tabs, upload panel, then the filter row and media grid. */
export default function Loading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <div className="mt-6 border-b border-panel-3 pb-4">
        <SegmentedSkeleton tabs={3} />
      </div>
      <div className="mt-5 flex flex-col gap-5">
        <PanelSkeleton note>
          <Bone className="h-10 w-full" />
        </PanelSkeleton>
        <section className="animate-pulse rounded-xl border border-panel-3 bg-panel p-5">
          <div className="flex flex-wrap gap-2">
            <Bone className="h-9 w-56" />
            <Bone className="h-9 w-36" />
          </div>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="overflow-hidden rounded-lg border border-panel-3">
                <Bone className="aspect-video w-full rounded-none" />
                <div className="space-y-2 p-4">
                  <Bone className="h-3.5 w-3/4" />
                  <Bone className="h-3 w-1/2" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageSkeleton>
  );
}
