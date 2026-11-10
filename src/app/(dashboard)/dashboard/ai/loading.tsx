import { PageSkeleton } from "../../page-header";

/** Axori AI opens fast; an empty frame stops the Home skeleton from flashing here. */
export default function Loading() {
  return <PageSkeleton>{null}</PageSkeleton>;
}
