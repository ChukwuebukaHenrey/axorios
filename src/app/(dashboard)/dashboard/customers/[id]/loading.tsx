import { Bone, PageHeaderSkeleton, PageSkeleton, PanelSkeleton, RowsSkeleton } from "../../../page-header";

/** One contact: back link, header with actions, detail panels, orders. */
export default function Loading() {
  return (
    <PageSkeleton>
      <Bone className="mb-3 h-5 w-28" />
      <PageHeaderSkeleton actions={2} />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
        <PanelSkeleton />
        <PanelSkeleton />
        <div className="lg:col-span-2">
          <PanelSkeleton flush>
            <RowsSkeleton rows={4} />
          </PanelSkeleton>
        </div>
      </div>
    </PageSkeleton>
  );
}
