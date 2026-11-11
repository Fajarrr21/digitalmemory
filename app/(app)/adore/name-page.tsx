import Link from "next/link";
import type { AdoreContent } from "@/lib/adore/queries";

/** Fixed palettes (not theme tokens) — this page is a little poster, same in light and dark. */
const THEMES: Record<string, { bg: string; ink: string; soft: string; accent: string }> = {
  cream: { bg: "#f8f1e7", ink: "#3b2a22", soft: "#7a6458", accent: "#b5626e" },
  blush: { bg: "#f6dfe1", ink: "#43262b", soft: "#80585f", accent: "#a94a5c" },
  night: { bg: "#1d1a24", ink: "#f3e9e2", soft: "#b9aab0", accent: "#e9a4b2" },
  grey: { bg: "#e7e5e4", ink: "#34302f", soft: "#6f6a68", accent: "#b06a78" },
};

/**
 * Your Name, My Favorite Word. title = her name / nickname, subtitle = the
 * quote, body = the dedication, category = theme.
 */
export function NamePage({ page, isAuthor }: { page: AdoreContent | null; isAuthor: boolean }) {
  if (!page) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-hand text-2xl text-accent-ink">belum ada ♡</p>
        <p className="text-sm text-ink-soft">
          {isAuthor ? "Tulis halamannya di Studio — koleksi “Namamu, Kata Favoritku”." : "Sebentar lagi."}
        </p>
        <Link href="/adore" className="text-xs text-ink-faint hover:text-ink">← the way i adore you</Link>
      </div>
    );
  }
  const t = THEMES[page.category ?? ""] ?? THEMES.cream;
  return (
    <div className="flex flex-col gap-4">
      <section
        className="flex min-h-[70vh] flex-col items-center justify-center rounded-3xl px-6 py-16 text-center shadow-sm"
        style={{ background: t.bg, color: t.ink }}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: t.soft }}>
          namamu, kata favoritku
        </p>
        <h1 className="mt-8 font-display text-6xl font-medium leading-none text-balance sm:text-7xl">{page.title}</h1>
        {page.subtitle ? (
          <p className="mt-6 max-w-sm font-hand text-2xl" style={{ color: t.accent }}>
            {page.subtitle}
          </p>
        ) : null}
        <p className="mt-10 max-w-md whitespace-pre-line font-display text-lg leading-[1.85]">{page.body}</p>
        <p className="mt-10 font-hand text-2xl" style={{ color: t.accent }}>— dari aku ♡</p>
        {isAuthor && page.status !== "published" ? (
          <p className="mt-6 font-mono text-[10px] uppercase" style={{ color: t.soft }}>{page.status === "draft" ? "draf" : page.status} · pratinjau</p>
        ) : null}
      </section>
      <Link href="/adore" className="self-center text-xs text-ink-faint hover:text-ink">← the way i adore you</Link>
    </div>
  );
}
