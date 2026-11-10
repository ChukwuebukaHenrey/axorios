import { Bone, PageSkeleton, ScrollListSkeleton, SegmentedSkeleton } from "../../page-header";

/** Inbox: chat list, thread and contact details in one bordered workspace. */
export default function Loading() {
  return (
    <PageSkeleton className="flex min-h-0 flex-col overflow-hidden pb-4">
      <div className="grid min-h-[520px] flex-1 animate-pulse grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border border-panel-3 bg-panel lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className="flex min-h-0 flex-col border-panel-3 lg:border-r">
          <div className="border-b border-panel-3 px-4 pt-3.5 pb-3">
            <Bone className="h-4 w-20" />
            <div className="mt-3">
              <SegmentedSkeleton tabs={4} size="sm" />
            </div>
          </div>
          <ScrollListSkeleton rows={9} />
        </aside>
        <div className="hidden min-h-0 flex-col lg:flex">
          <div className="flex items-center gap-3 border-b border-panel-3 px-5 py-3">
            <Bone className="size-9 rounded-full" />
            <Bone className="h-4 w-36" />
          </div>
          <div className="flex flex-1 flex-col justify-end gap-3 p-5">
            <Bone className="h-12 w-2/3" />
            <Bone className="ml-auto h-10 w-1/2" />
            <Bone className="h-16 w-3/5" />
          </div>
          <div className="border-t border-panel-3 p-4">
            <Bone className="h-10 w-full" />
          </div>
        </div>
        <aside className="hidden flex-col items-center gap-3 border-l border-panel-3 px-5 py-5 xl:flex">
          <Bone className="size-14 rounded-full" />
          <Bone className="h-4 w-32" />
          <Bone className="h-3 w-24" />
        </aside>
      </div>
    </PageSkeleton>
  );
}
