import { PageHeaderSkeleton, PageSkeleton, RowsSkeleton, StatRowSkeleton, TabRowSkeleton } from "../../page-header";

/** Orders: four tiles, status strip with search, then the order table. */
export default function Loading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <StatRowSkeleton className="mt-6" />
      <TabRowSkeleton tabs={6} right="search" />
      <div className="mt-4 animate-pulse overflow-hidden rounded-xl border border-panel-3 bg-panel">
        <div className="hidden h-9 border-b border-panel-3 bg-panel-2/40 md:block" />
        <RowsSkeleton rows={10} />
      </div>
    </PageSkeleton>
  );
}
