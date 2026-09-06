import Link from "next/link";

/** Discreet, always-available entry to the Comfort Room. */
export function ComfortButton() {
  return (
    <Link
      href="/comfort"
      title="It's okay, you're here."
      className="fixed bottom-20 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-rule bg-paper/90 text-accent-ink shadow-[var(--shadow-soft)] backdrop-blur-sm transition hover:-translate-y-0.5 md:bottom-6 md:right-6"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M12 20s-6.5-4.3-9-8.2C1.4 9 2.5 5.7 5.7 5.2 7.8 4.9 9.4 6 12 8.6c2.6-2.6 4.2-3.7 6.3-3.4 3.2.5 4.3 3.8 2.7 6.6C18.5 15.7 12 20 12 20Z" />
      </svg>
      <span className="sr-only">Comfort Room</span>
    </Link>
  );
}
