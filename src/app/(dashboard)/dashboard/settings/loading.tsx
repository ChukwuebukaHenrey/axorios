import { Bone, LinesSkeleton, PageHeaderSkeleton, PageSkeleton } from "../../page-header";

/** Settings: fixed header, section list on the left from lg, body on the right. */
export default function Loading() {
  return (
    <PageSkeleton className="px-0 pt-0 pb-0 sm:px-0 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden lg:px-0">
      <div className="border-b border-panel-3 px-4 pt-6 pb-5 sm:px-6 lg:px-8">
        <PageHeaderSkeleton />
      </div>
      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row">
        <nav className="flex gap-1 overflow-hidden border-b border-panel-3 px-4 py-2 sm:px-6 lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0 lg:px-4 lg:py-5">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="flex h-9 shrink-0 items-center px-3">
              <Bone className="h-3.5 w-24" />
            </span>
          ))}
        </nav>
        <div className="min-w-0 flex-1 px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-6">
          <section className="max-w-3xl animate-pulse rounded-xl border border-panel-3 bg-panel p-5">
            <Bone className="h-4 w-32" />
            <div className="mt-4">
              <LinesSkeleton lines={4} />
            </div>
          </section>
        </div>
      </div>
    </PageSkeleton>
  );
}
