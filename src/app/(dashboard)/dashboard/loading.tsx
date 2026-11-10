import { Bone, ChartSkeleton, PageHeaderSkeleton, PageSkeleton, PanelSkeleton, RowsSkeleton, SegmentedSkeleton } from "../page-header";

/** Home: Sales and Recent orders on the left; Needs you, Store and Last post on the right. */
export default function Loading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <div className="mt-6 grid items-start gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <PanelSkeleton note action={<SegmentedSkeleton tabs={4} size="sm" />}>
            <Bone className="h-8 w-40" />
            <Bone className="mt-2 h-4 w-48" />
            <div className="mt-4">
              <ChartSkeleton />
            </div>
          </PanelSkeleton>
          <PanelSkeleton note flush>
            <RowsSkeleton rows={5} />
          </PanelSkeleton>
        </div>
        <div className="space-y-4">
          <PanelSkeleton note flush>
            <RowsSkeleton rows={4} />
          </PanelSkeleton>
          <PanelSkeleton>
            <div className="grid grid-cols-2 gap-4">
              <Bone className="h-12" />
              <Bone className="h-12" />
            </div>
          </PanelSkeleton>
          <PanelSkeleton />
        </div>
      </div>
    </PageSkeleton>
  );
}
