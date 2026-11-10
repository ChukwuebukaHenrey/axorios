import { ChartSkeleton, PageHeaderSkeleton, PageSkeleton, PanelSkeleton, RowsSkeleton, StatRowSkeleton, TabRowSkeleton } from "../../page-header";

/** Store overview: header with View live and Edit, tabs with period, tiles, visits chart beside the preview, top products. */
export default function Loading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton actions={2} />
      <TabRowSkeleton tabs={4} right="period" />
      <div className="mt-5 space-y-4">
        <StatRowSkeleton detail={false} />
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PanelSkeleton>
              <ChartSkeleton />
            </PanelSkeleton>
          </div>
          <PanelSkeleton>
            <div className="min-h-[240px] flex-1 rounded-md border border-panel-3 bg-ink" />
          </PanelSkeleton>
        </div>
        <PanelSkeleton note flush>
          <RowsSkeleton rows={5} />
        </PanelSkeleton>
      </div>
    </PageSkeleton>
  );
}
