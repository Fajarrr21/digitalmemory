import Link from "next/link";

export function BackLink({ href = "/words", label = "little words." }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm text-ink-faint transition hover:text-accent-ink">
      <span aria-hidden>←</span> {label}
    </Link>
  );
}

/** A soft notice when the server has no AI key — the page still works by hand. */
export function AiOffNotice() {
  return (
    <div className="rounded-2xl border border-dashed border-rule bg-paper-2/40 p-4 text-sm text-ink-soft">
      Sang Muse belum dinyalakan: <code className="font-mono text-xs">GEMINI_API_KEY</code> belum diatur di server. Kamu tetap
      bisa menulis dan menyimpan dengan tanganmu sendiri. ♡
    </div>
  );
}

export function stash(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota — the caller falls back to the URL.
  }
}
