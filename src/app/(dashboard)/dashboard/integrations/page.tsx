import { redirect } from "next/navigation";

/** Connections moved into Settings (spec v2). Old links still land in the right place. */
export default function IntegrationsPage() {
  redirect("/dashboard/settings?section=connections");
}
