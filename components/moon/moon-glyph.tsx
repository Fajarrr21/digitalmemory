import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * her little moon. — a small moon that fills as the cycle goes on. Purely
 * decorative (the page always says the day in words); with no data it's a
 * quiet new moon. `fraction` 0..1 = how far through her usual cycle.
 */
export function MoonGlyph({ fraction, glow = false, className }: { fraction: number | null; glow?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const f = fraction === null ? 0 : Math.max(0, Math.min(1, fraction));
  // A lit disc with a shadow disc sliding across it.
  const shift = 100 * f;
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={cn("h-full w-full", className)}>
      <defs>
        <radialGradient id={`halo-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#f4c7cf" stopOpacity={glow ? 0.55 : 0.25} />
          <stop offset="100%" stopColor="#f4c7cf" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`disc-${id}`}>
          <circle cx="50" cy="50" r="30" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#halo-${id})`} />
      <circle cx="50" cy="50" r="30" fill="#5b4152" />
      <g clipPath={`url(#disc-${id})`}>
        <circle cx={50 - 60 + shift * 1.2} cy="50" r="30" fill="#fbe9dc" />
        <circle cx="40" cy="42" r="4" fill="#ecd3c3" opacity={f > 0.3 ? 0.8 : 0} />
        <circle cx="58" cy="60" r="3" fill="#ecd3c3" opacity={f > 0.5 ? 0.8 : 0} />
      </g>
      <circle cx="50" cy="50" r="30" fill="none" stroke="#f4c7cf" strokeOpacity="0.5" />
    </svg>
  );
}
