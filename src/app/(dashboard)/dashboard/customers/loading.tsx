import { Bone, PageHeaderSkeleton, PageSkeleton, RowsSkeleton, SegmentedSkeleton } from "../../page-header";

/** Customers: tab strip, then the contacts panel with its filter row and table. */
export default function Loading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <div className="mt-6 border-b border-panel-3 pb-4">
        <SegmentedSkeleton tabs={3} />
      </div>
      <section className="mt-5 animate-pulse rounded-xl border border-panel-3 bg-panel p-5">
        <div className="flex flex-wrap gap-2">
          <Bone className="h-9 w-56" />
          <Bone className="h-9 w-36" />
          <Bone className="h-9 w-36" />
        </div>
        <div className="-mx-5 mt-4 border-t border-panel-3">
          <RowsSkeleton rows={10} />
        </div>
      </section>
    </PageSkeleton>
  );
}
