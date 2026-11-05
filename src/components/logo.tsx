/** The AxoriOS Doorway mark. */
export function Logo({ className, door = "#F97316" }: { className?: string; door?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M39 12C42 7 58 7 61 12L97 86C99 90 97 92 93 92H72L70 48C70 42 67 38 62 36L52 31C50 30 48 30 46 31L38 36C33 39 31 43 31 48L29 92H7C3 92 1 90 3 86Z"
      />
      <path fill={door} d="M50 46L63 53L65 90L50 81Z" />
    </svg>
  );
}
