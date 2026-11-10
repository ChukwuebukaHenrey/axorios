import { Bone, LinesSkeleton, PageHeaderSkeleton, PageSkeleton } from "../../../page-header";

function Card({ lines = 4 }: { lines?: number }) {
  return (
    <section className="animate-pulse rounded-xl border border-panel-3 bg-panel p-5">
      <Bone className="h-3.5 w-28" />
      <div className="mt-4">
        <LinesSkeleton lines={lines} />
      </div>
    </section>
  );
}

/** One order: back link, title with the refund button, four cards. */
export default function Loading() {
  return (
    <PageSkeleton>
      <Bone className="h-5 w-24" />
      <div className="mt-3">
        <PageHeaderSkeleton actions={1} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card />
        <Card lines={5} />
        <Card />
        <Card lines={2} />
      </div>
    </PageSkeleton>
  );
}
