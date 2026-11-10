import Image from "next/image";
import { t } from "@/lib/messages";
import { CONTAINER, SECTION, SectionHeading } from "./ui";

const n = t.marketing.home.notes;
const SPEC_URL = "https://github.com/ChukwuebukaHenrey/axorios/blob/main/docs/spec.md";
const IMAGES = ["/images/marketing/note-naira-dollars.webp", "/images/marketing/note-approvals.webp", "/images/marketing/note-telegram.webp"];

/** The reference's blog row. AxoriOS has no blog, so the cards point at the product spec. */
export function NotesSection() {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={n.eyebrow} title={n.title} subhead={n.subhead} />
        <ul className="mt-16 grid gap-5 md:grid-cols-3">
          {n.items.map((item, i) => (
            <li key={item.title}>
              <a href={SPEC_URL} target="_blank" rel="noreferrer" className="group block">
                <div className="relative aspect-[373/300] overflow-hidden rounded-2xl">
                  <Image
                    src={IMAGES[i]}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 373px, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-3 font-mono text-sm text-cream/90">
                  {item.category} · {n.readMore}
                </p>
                <h3 className="mt-3 font-display text-2xl leading-tight font-medium tracking-[-0.02em] text-cream group-hover:underline">
                  {item.title}
                </h3>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
