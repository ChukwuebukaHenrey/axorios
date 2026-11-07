import Link from "next/link";
import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";
import { Button, CONTAINER, Sparkle } from "./ui";

const f = t.marketing.footer;
const REPO_URL = "https://github.com/ChukwuebukaHenrey/axorios";

const COLUMNS = [
  {
    title: f.main,
    links: [
      { href: "/", label: f.home },
      { href: "/features", label: f.features },
      { href: "/use-case", label: f.useCase },
      { href: "/integrations", label: f.integrations },
    ],
  },
  {
    title: f.other,
    links: [
      { href: "/pricing", label: f.pricing },
      { href: "/s/demo", label: f.demo },
      { href: "/sign-in", label: f.signIn },
    ],
  },
  {
    title: f.utilities,
    links: [
      { href: REPO_URL, label: f.source, external: true },
      { href: `${REPO_URL}/blob/main/docs/spec.md`, label: f.spec, external: true },
      { href: "/404", label: f.notFound },
    ],
  },
];

/** The closing banner that sits above the footer on every page. */
export function CtaBanner() {
  const c = t.marketing.cta;
  return (
    <section className="py-20 sm:py-[150px]">
      <div className={CONTAINER}>
        <div className="relative isolate overflow-hidden rounded-3xl bg-black px-6 py-20 text-center sm:py-36">
          <div
            aria-hidden="true"
            className="absolute -bottom-1/2 left-1/2 -z-10 aspect-[3/2] w-[130%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,#e3ff48_0%,#b6d62a_35%,#3b4a0c_70%,transparent_100%)] opacity-90"
          />
          <div aria-hidden="true" className="grain absolute inset-0 -z-10 opacity-60" />
          <Sparkle className="absolute top-1/2 left-1/2 -z-10 size-[260px] -translate-x-1/2 -translate-y-1/2 text-cream/10 sm:size-[334px]" />
          <h2 className="mx-auto max-w-[885px] font-display text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-cream">
            {c.title}
          </h2>
          <p className="mx-auto mt-5 max-w-[579px] text-base leading-relaxed text-cream/85 sm:text-lg">{c.body}</p>
          <Button href="/sign-up" variant="cream" className="mt-9">
            {c.button}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="pt-16 pb-10 sm:pt-[120px]">
      <div className={CONTAINER}>
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[275px_1fr_1fr_1fr] lg:gap-0">
          <div className="lg:pr-10">
            <Link href="/" className="flex items-center gap-3 text-cream">
              <Logo className="size-8" />
              <span className="font-display text-[22px] font-medium tracking-tight">{t.marketing.brand}</span>
            </Link>
            <p className="mt-6 text-base leading-relaxed text-stone">{f.tagline}</p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title} className="lg:justify-self-center">
              <p className="font-display text-base font-medium text-cream">{column.title}</p>
              <ul className="mt-5 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {"external" in link ? (
                      <a href={link.href} target="_blank" rel="noreferrer" className="text-base text-stone transition hover:text-cream">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="text-base text-stone transition hover:text-cream">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 border-t border-panel-3 pt-8 text-base text-stone sm:mt-[120px]">{f.copyright}</div>
      </div>
    </footer>
  );
}
