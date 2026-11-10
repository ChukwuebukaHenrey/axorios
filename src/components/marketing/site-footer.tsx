import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { t } from "@/lib/messages";
import { Button, CONTAINER, Sparkle } from "./ui";

const f = t.marketing.footer;
const REPO_URL = "https://github.com/ChukwuebukaHenrey/axorios";

const COLUMNS = [
  {
    title: f.product,
    links: [
      { href: "/features", label: f.features },
      { href: "/use-case", label: f.useCase },
      { href: "/integrations", label: f.integrations },
      { href: "/pricing", label: f.pricing },
    ],
  },
  {
    title: f.tryIt,
    links: [
      { href: "/s/demo", label: f.demo },
      { href: "/sign-up", label: f.signUp },
      { href: "/sign-in", label: f.signIn },
    ],
  },
  {
    title: f.project,
    links: [
      { href: REPO_URL, label: f.source, external: true },
      { href: `${REPO_URL}/blob/main/docs/spec.md`, label: f.spec, external: true },
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

const linkClass = "inline-flex min-h-8 items-center text-[15px] text-cream/70 transition-colors hover:text-cream focus-visible:text-cream focus-visible:outline-none";

/**
 * Links sit on the artwork's dark sky; the landscape rises underneath. The art keeps its full width and is pinned to
 * the bottom of the card, so nothing important is cropped. Phones reserve room under the links for it instead of
 * scaling it down behind them.
 */
export function SiteFooter() {
  return (
    <footer className="pt-10 pb-5 sm:pt-16 sm:pb-8">
      <div className={CONTAINER}>
        <div className="relative isolate overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0b0e10] px-6 pt-10 pb-[64vw] sm:px-10 sm:pt-14 sm:pb-[46vw] lg:aspect-[1448/1190] lg:px-14 lg:pb-14">
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 aspect-[1448/1086]">
            <Image src="/images/marketing/footer-landscape.webp" alt="" fill sizes="(min-width: 1160px) 1160px, 100vw" className="object-cover object-bottom" />
            {/* Fades the art's top edge into the card so the sky and the card read as one surface. */}
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[#0b0e10] to-transparent" />
          </div>

          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
            <div className="sm:col-span-3 lg:col-span-1 lg:pr-8">
              <Link href="/" className="inline-flex items-center gap-3 text-cream">
                <Logo className="size-8" />
                <span className="font-display text-[22px] font-medium tracking-tight">{t.marketing.brand}</span>
              </Link>
              <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-cream/65">{f.tagline}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:col-span-3 sm:grid-cols-3 lg:col-span-3">
              {COLUMNS.map((column) => (
                <nav key={column.title} aria-label={column.title}>
                  <p className="text-xs font-medium tracking-wide text-stone uppercase">{column.title}</p>
                  <ul className="mt-3 flex flex-col gap-1">
                    {column.links.map((link) => (
                      <li key={link.href}>
                        {"external" in link ? (
                          <a href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
                            {link.label}
                          </a>
                        ) : (
                          <Link href={link.href} className={linkClass}>
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-1 border-t border-white/10 pt-5 text-sm text-cream/60 sm:flex-row sm:items-center sm:justify-between">
            <span>{f.copyright}</span>
            <span>{f.builtFor}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
