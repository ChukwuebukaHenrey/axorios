import { ChartSkeleton, LinesSkeleton, PageHeaderSkeleton, PageSkeleton, PanelSkeleton, StatRowSkeleton, TabRowSkeleton } from "../../page-header";

/** Money overview: seven tabs and the period strip, four tiles, daily chart beside money out. */
export default function Loading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <TabRowSkeleton tabs={7} right="period" />
      <div className="mt-5 space-y-4">
        <StatRowSkeleton />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <PanelSkeleton>
            <ChartSkeleton />
          </PanelSkeleton>
          <PanelSkeleton>
            <LinesSkeleton lines={5} />
          </PanelSkeleton>
        </div>
      </div>
    </PageSkeleton>
  );
}
