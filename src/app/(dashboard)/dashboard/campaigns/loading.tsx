import { Bone, PageHeaderSkeleton, PageSkeleton, TabRowSkeleton } from "../../page-header";

/** Marketing posts: header with the Make posts button, tabs with period, then a grid of post cards. */
export default function Loading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton actions={1} />
      <TabRowSkeleton tabs={3} right="period" />
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="animate-pulse overflow-hidden rounded-xl border border-panel-3 bg-panel">
            <Bone className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Bone className="h-3.5 w-full" />
              <Bone className="h-3.5 w-2/3" />
              <Bone className="mt-3 h-8 w-24" />
            </div>
          </li>
        ))}
      </ul>
    </PageSkeleton>
  );
}
