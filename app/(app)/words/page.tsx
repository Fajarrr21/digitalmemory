import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getWordsHome } from "@/lib/words/queries";
import { aiConfigured } from "@/lib/words/ai";
import { excerpt, fallbackTitle } from "@/lib/words/logic";
import { workTypeOf } from "@/lib/words/options";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { NotReady } from "./not-ready";
import { BlankPageButton } from "./blank-page-button";

export const metadata: Metadata = { title: "little words. ♡" };

/**
 * little words. — a private literary space for two. An editorial, quiet
 * front page: the five rooms, and what you wrote most recently.
 */
export default async function WordsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const [home, partner] = await Promise.all([getWordsHome(ctx.spaceId, ctx.userId), getPartner(ctx.spaceId, ctx.userId)]);
  if (!home.ready) return <NotReady />;
  const ai = aiConfigured();
  const them = partner?.name ?? "Dia";

  return (
    <div className="flex flex-col gap-8">
      <header className="pt-2 text-center">
        <h1 className="font-display text-[42px] font-medium leading-none tracking-tight text-ink md:text-5xl">
          little words. <span className="text-accent-ink">♡</span>
        </h1>
        <p className="mx-auto mt-4 max-w-sm font-display text-lg italic text-ink-soft text-balance">
          A little space for everything we cannot always say.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            href="/words/muse"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 font-medium text-[#4a2b30] shadow-[var(--shadow-lift)] transition hover:-translate-y-px hover:brightness-[1.03]"
          >
            ✒️ Create Something Beautiful
          </Link>
          <BlankPageButton />
        </div>
      </header>

      {home.waiting > 0 || home.sealed > 0 ? (
        <Link href="/words/to-you" className="group block">
          <PaperCard className="relative overflow-hidden bg-gradient-to-br from-blush/50 to-paper transition group-hover:-translate-y-0.5">
            <Eyebrow>to you ♡</Eyebrow>
            <p className="mt-2 font-display text-xl text-ink text-balance">
              {home.waiting > 0
                ? `${them} left ${home.waiting === 1 ? "a little word" : `${home.waiting} little words`} for you.`
                : `Something from ${them} is waiting for its moment.`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {home.sealed > 0 ? `${home.sealed} masih tersegel sampai waktunya · ` : ""}Buka →
            </p>
            <span aria-hidden className="pointer-events-none absolute -right-1 -bottom-3 text-6xl opacity-15 transition group-hover:scale-105">
              ✉️
            </span>
          </PaperCard>
        </Link>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Room
          href="/words/muse"
          eyebrow="The Muse"
          title="Create from a feeling."
          sub={ai ? "Satu gagasan, beberapa cara untuk mengatakannya." : "AI belum dinyalakan di server."}
          glyph="✒️"
        />
        <Room
          href="/words/rewrite"
          eyebrow="The Rewrite"
          title="Transform your words."
          sub={ai ? "Tulisanmu, lebih indah — maknanya tetap milikmu." : "AI belum dinyalakan di server."}
          glyph="🪶"
        />
        <Room
          href="/words/library"
          eyebrow="The Library"
          title="Everything you've written."
          sub={`${home.counts.works} karya · ${home.counts.drafts} draft${home.counts.received ? ` · ${home.counts.received} dari ${them}` : ""}`}
          glyph="📚"
        />
        <Room
          href="/words/to-you"
          eyebrow="To You"
          title={`Words between you and ${them}.`}
          sub={home.waiting ? `${home.waiting} menunggu dibuka` : "Kirim, terima, Open When…"}
          glyph="💌"
        />
        <Room href="/words/canvas" eyebrow="The Canvas" title="Make it something to keep." sub="Kartu puisi · PNG untuk story" glyph="🎨" />
        <Link href="/words/lines" className="group block">
          <PaperCard className="relative h-full overflow-hidden transition group-hover:-translate-y-0.5">
            <Eyebrow>Lines I Love</Eyebrow>
            {home.recentLines[0] ? (
              <p className="mt-2 line-clamp-3 font-display text-lg italic text-ink text-balance">“{home.recentLines[0].text}”</p>
            ) : (
              <p className="mt-2 font-display text-lg text-ink">The lines you couldn&apos;t let go.</p>
            )}
            <p className="mt-1 text-sm text-ink-soft">{home.counts.lines} baris tersimpan →</p>
          </PaperCard>
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Eyebrow>Recently Written</Eyebrow>
          {home.recent.length ? (
            <Link href="/words/library" className="text-sm text-ink-soft hover:text-accent-ink">
              Semua →
            </Link>
          ) : null}
        </div>
        {home.recent.length ? (
          <ul className="flex flex-col divide-y divide-rule-soft rounded-2xl border border-rule bg-paper">
            {home.recent.map((w) => (
              <li key={w.id}>
                <Link href={`/words/w/${w.id}`} className="flex gap-4 px-5 py-4 transition hover:bg-paper-2/50">
                  <span aria-hidden className="mt-1 text-lg">
                    {workTypeOf(w.work_type).emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate font-display text-[17px] text-ink">{w.title || fallbackTitle(w.content)}</span>
                      {w.status === "draft" ? (
                        <span className="flex-none rounded-full border border-rule px-2 font-mono text-[10px] uppercase text-ink-faint">draft</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-ink-soft">{excerpt(w.content, 90) || "Halaman kosong"}</span>
                  </span>
                  <span className="flex-none pt-1 font-mono text-[11px] text-ink-faint">
                    {formatDistanceToNowStrict(new Date(w.updated_at), { locale: localeId })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <PaperCard className="border-dashed text-center">
            <p className="font-hand text-2xl text-accent-ink">the first page is waiting</p>
            <p className="mt-1 text-sm text-ink-soft">Mulai dari satu perasaan — atau dari halaman kosong.</p>
          </PaperCard>
        )}
      </section>

      <footer className="pb-4 text-center font-display text-sm italic text-ink-faint">
        Some words are written to be read. Others are written to be remembered.
      </footer>
    </div>
  );
}

function Room({ href, eyebrow, title, sub, glyph }: { href: string; eyebrow: string; title: string; sub: string; glyph: string }) {
  return (
    <Link href={href} className="group block">
      <PaperCard className="relative h-full overflow-hidden transition group-hover:-translate-y-0.5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <p className="mt-2 font-display text-lg text-ink text-balance">{title}</p>
        <p className="mt-1 text-sm text-ink-soft">{sub}</p>
        <span aria-hidden className="pointer-events-none absolute -right-1 -bottom-3 text-5xl opacity-10 transition group-hover:scale-105">
          {glyph}
        </span>
      </PaperCard>
    </Link>
  );
}
