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

/** A tilted card that peeks up from the banner's bottom edge (the banner clips its lower half). */
function PeekCard({ eyebrow, value, note, side }: { eyebrow: string; value: string; note: string; side: "left" | "right" }) {
  const place =
    side === "left"
      ? "left-[-12%] rotate-[-9deg] sm:left-[-2%] lg:left-[3%]"
      : "right-[-12%] rotate-[9deg] sm:right-[-2%] lg:right-[3%]";
  return (
    <div
      aria-hidden="true"
      className={`absolute -bottom-16 w-[min(52vw,360px)] sm:w-[min(40vw,360px)] rounded-[28px] bg-cream px-6 pt-6 pb-24 text-left text-black shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)] sm:-bottom-14 sm:px-8 sm:pt-8 ${place}`}
    >
      <p className="text-[13px] text-black/55 sm:text-sm">{eyebrow}</p>
      <p className="mt-2 font-display text-[clamp(1.6rem,3.4vw,2.4rem)] leading-none font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-3 text-[13px] text-black/60 sm:text-sm">{note}</p>
    </div>
  );
}

/**
 * The closing banner above the footer on every page: full width, rounded, lime light falling from the top, with two
 * tilted cards (a sale in two currencies, an approval) rising from its bottom edge.
 */
export function CtaBanner() {
  const c = t.marketing.cta;
  return (
    <section className="relative isolate overflow-hidden rounded-[32px] bg-[#1a2005] px-5 pt-20 pb-[clamp(200px,34vw,300px)] text-center sm:rounded-[48px] sm:pt-28">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_50%_0%,#efff8a_0%,#e3ff48_22%,#b6d62a_48%,#5d7212_78%,#2a3408_100%)]"
      />
      <div aria-hidden="true" className="grain absolute inset-0 -z-10 opacity-40" />
      <Sparkle className="absolute top-[38%] left-1/2 -z-10 size-[240px] -translate-x-1/2 -translate-y-1/2 text-white/25 sm:size-[320px]" />
      <h2 className="mx-auto max-w-[885px] font-display text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-black">
        {c.title}
      </h2>
      <p className="mx-auto mt-5 max-w-[579px] text-base leading-relaxed text-black/70 sm:text-lg">{c.body}</p>
      <Button href="/sign-up" variant="black" className="mt-9 h-12 px-6">
        {c.button}
      </Button>
      <PeekCard side="left" eyebrow={c.storeEyebrow} value={c.storeValue} note={c.storeNote} />
      <PeekCard side="right" eyebrow={c.approvalEyebrow} value={c.approvalValue} note={c.approvalNote} />
    </section>
  );
}

const linkClass = "inline-flex min-h-8 items-center text-[15px] text-cream/70 transition-colors hover:text-cream focus-visible:text-cream focus-visible:outline-none";

/**
 * Full-bleed footer: links on the artwork's dark sky, the landscape across the whole width underneath. The art keeps
 * its proportions and is pinned to the bottom, so on wide screens only the empty sky is cropped. Phones reserve room
 * under the links for it instead of scaling it down behind them.
 */
export function SiteFooter() {
  return (
    <footer className="relative isolate mt-6 overflow-hidden bg-black sm:mt-10">
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 aspect-[1448/1086]">
        <Image src="/images/marketing/footer-landscape.webp" alt="" fill sizes="100vw" className="object-cover object-bottom" />
        {/* Fades the art's top edge into the footer so the sky and the footer read as one surface. */}
        <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>
      <div className={`${CONTAINER} pt-14 pb-[64vw] sm:pt-16 sm:pb-[46vw] lg:pb-[min(44vw,720px)]`}>
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
    </footer>
  );
}
