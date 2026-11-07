import Image from "next/image";

/** The AxoriOS mark. `className` sets the square size, e.g. `size-6`. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`relative inline-block shrink-0 ${className ?? ""}`}>
      <Image src="/logo.png" alt="" fill sizes="48px" className="object-contain" priority />
    </span>
  );
}
