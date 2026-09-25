type Theme = "color" | "light";

/**
 * Standalone brand mark: a stylized house roofline over a rounded body
 * with a cross cutout, filled with the Profesionales SRL green-to-teal
 * gradient. Pure inline SVG — no raster assets involved.
 */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="brandMarkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6BDD6F" />
          <stop offset="45%" stopColor="var(--brand-green)" />
          <stop offset="100%" stopColor="var(--brand-teal)" />
        </linearGradient>
      </defs>
      <path
        d="M16 36 L50 8 L84 36"
        fill="none"
        stroke="url(#brandMarkGrad)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="26" y="34" width="48" height="48" rx="10" fill="url(#brandMarkGrad)" />
      <rect x="42" y="45" width="16" height="26" rx="3" fill="white" />
      <rect x="31" y="56" width="38" height="16" rx="3" fill="white" />
    </svg>
  );
}

/**
 * Text wordmark "profesionales" with an optional tagline, rendered with
 * the same brand gradient (on light backgrounds) or plain white (on the
 * dark sidebar / hero backgrounds).
 */
export function BrandWordmark({
  theme = "color",
  tagline = false,
  className = "text-2xl",
}: {
  theme?: Theme;
  tagline?: boolean;
  className?: string;
}) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span
        className={`font-sans font-extrabold tracking-tight ${className} ${
          theme === "light"
            ? "text-white"
            : "bg-gradient-to-r from-[var(--brand-green)] to-[var(--brand-teal)] bg-clip-text text-transparent"
        }`}
      >
        profesionales
      </span>
      {tagline && (
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase mt-0.5 text-[var(--brand-teal)]">
          Servicios especializados
        </span>
      )}
    </span>
  );
}
