import Image from "next/image";
import { AboutOrbit } from "@/components/marketing/about-orbit";
import { FaqSection } from "@/components/marketing/faq-section";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { GlassFrame, PhotoHero } from "@/components/marketing/hero";
import { IntegrationWall } from "@/components/marketing/integration-wall";
import { LogoMarquee } from "@/components/marketing/logo-marquee";
import { NotesSection } from "@/components/marketing/notes-section";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { ProblemSection } from "@/components/marketing/problem-section";
import { ProcessDial } from "@/components/marketing/process-dial";
import { ServicesSection } from "@/components/marketing/services-section";
import { CtaBanner, SiteFooter } from "@/components/marketing/site-footer";
import { StatsGrid } from "@/components/marketing/stats-grid";
import { StoriesCarousel } from "@/components/marketing/stories-carousel";
import { t } from "@/lib/messages";

const h = t.marketing.home;

export default function Home() {
  return (
    <main className="bg-black font-display text-cream">
      <PhotoHero
        background="/images/marketing/home-bg.png"
        headline={h.headline}
        subhead={h.subhead}
        cta={h.cta}
        visual={
          <GlassFrame className="max-w-[1000px]">
            <Image
              src="/images/marketing/home-dash.png"
              alt={h.dashAlt}
              width={1448}
              height={1086}
              priority
              sizes="(min-width: 1024px) 1000px, 100vw"
              className="h-auto w-full rounded-2xl"
            />
          </GlassFrame>
        }
      />
      <LogoMarquee />
      {/* Each section fades up as it scrolls into view (CSS only, see .reveal in globals.css). */}
      <div className="reveal">
        <AboutOrbit />
      </div>
      <div className="reveal">
        <ProblemSection />
      </div>
      <div className="reveal">
        <FeaturesGrid />
      </div>
      <div className="reveal">
        <ProcessDial />
      </div>
      <div className="reveal">
        <ServicesSection />
      </div>
      <div className="reveal">
        <StatsGrid />
      </div>
      <div className="reveal">
        <IntegrationWall />
      </div>
      <div className="reveal">
        <PricingCards />
      </div>
      <div className="reveal">
        <StoriesCarousel />
      </div>
      <div className="reveal">
        <NotesSection />
      </div>
      <div className="reveal">
        <FaqSection />
      </div>
      <CtaBanner />
      <SiteFooter />
    </main>
  );
}
