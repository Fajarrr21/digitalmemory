import { cn } from "@/lib/utils";

/** Envelope-with-a-heart-seal wordmark glyph. Colors follow the theme tokens. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    >
      <rect
        x="5.5"
        y="9.5"
        width="21"
        height="14"
        rx="2.4"
        fill="var(--blush)"
        stroke="var(--accent-ink)"
        strokeWidth="1.6"
      />
      <path
        d="M6.6 10.8 16 17.2 25.4 10.8"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 22.6c-2.3-1.7-3.8-2.9-3.8-4.5 0-1 .77-1.75 1.75-1.75.7 0 1.35.42 2.05 1.25.7-.83 1.35-1.25 2.05-1.25.98 0 1.75.75 1.75 1.75 0 1.6-1.5 2.8-3.8 4.5z"
        fill="var(--accent)"
        stroke="var(--accent-ink)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}
