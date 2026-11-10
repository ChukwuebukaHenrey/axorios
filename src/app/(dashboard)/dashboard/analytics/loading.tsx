import { PageHeaderSkeleton, PageSkeleton } from "../../page-header";

/** Analytics: header, then the report area at the size of the Suspense fallback. */
export default function Loading() {
  return (
    <PageSkeleton className="flex flex-col">
      <PageHeaderSkeleton />
      <div className="mt-5 h-[78vh] min-h-[560px] animate-pulse rounded-xl border border-panel-3 bg-panel" />
    </PageSkeleton>
  );
}
