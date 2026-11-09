import { PageHeader } from "../page-header";
import { requireSeller } from "../session";

export const metadata = { title: "Home | AxoriOS" };

/** Home: a glance only. Tiles arrive in step 6.8. */
export default async function HomePage() {
  const { user } = await requireSeller();
  const name = (user.user_metadata?.first_name as string | undefined) ?? "";
  return (
    <main className="flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
      <PageHeader title={name ? `Hi ${name}` : "Home"} subtitle="Your business at a glance." />
    </main>
  );
}
