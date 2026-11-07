/**
 * A soft wave seam between a flat-colour band and the page. Give it the upcoming (or departing)
 * band's text colour via `className` (e.g. "text-store-primary") since it fills with `currentColor`.
 */
export function WaveDivider({ flip = false, className = "" }: { flip?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={`block h-8 w-full sm:h-12 ${flip ? "rotate-180" : ""} ${className}`}
    >
      <path d="M0,32 C240,78 480,2 720,26 C960,50 1200,10 1440,40 L1440,80 L0,80 Z" fill="currentColor" />
    </svg>
  );
}
