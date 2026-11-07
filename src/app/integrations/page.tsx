import { IntegrationCatalog } from "@/components/marketing/integration-catalog";
import { IntegrationWall } from "@/components/marketing/integration-wall";
import { CtaBanner, SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";

export const metadata = { title: "Integrations | AxoriOS" };

export default function IntegrationsPage() {
  return (
    <main className="bg-black font-display text-cream">
      <SiteNav theme="dark" />
      <IntegrationWall />
      <IntegrationCatalog />
      <CtaBanner />
      <SiteFooter />
    </main>
  );
}
