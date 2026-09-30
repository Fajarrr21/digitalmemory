import type { Metadata } from "next";
import Link from "next/link";
import { getSpaceContext } from "@/lib/auth";
import { formatDateLabel } from "@/lib/date";
import { getWatchMemories } from "@/lib/watch/queries";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = { title: "Things We Watched" };

/** 📚 Everything the two of you have sat down for, newest first. */
export default async function WatchHistoryPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const memories = await getWatchMemories(ctx.spaceId, 100);
  const totalMinutes = memories.reduce((sum, m) => sum + m.minutes, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <Eyebrow>🍿 things we watched</Eyebrow>
        <h1 className="mt-3 font-display text-2xl font-medium text-ink text-balance sm:text-3xl">
          Things We Watched
        </h1>
        {memories.length > 0 ? (
          <p className="mt-2 font-hand text-xl text-accent-ink">
            {memories.length} kali, {totalMinutes} menit bareng ♡
          </p>
        ) : null}
      </div>

      {memories.length === 0 ? (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-xl text-accent-ink">belum ada apa-apa di sini</p>
          <p className="mt-1 text-sm text-ink-soft">
            Setiap nonton bareng yang kalian simpan akan berbaris di halaman ini.
          </p>
          <Link href="/watch" className="mt-4 inline-block text-sm text-accent-ink hover:underline">
            Mulai nonton bareng →
          </Link>
        </PaperCard>
      ) : (
        <ol className="relative ml-2 flex flex-col gap-6 border-l-2 border-rule pl-7">
          {memories.map((m) => (
            <li key={m.id} className="relative">
              <span
                aria-hidden
                className="absolute -left-[35px] top-3 h-3.5 w-3.5 rounded-full border-2 border-accent bg-ground"
              />
              <Link href={`/watch/${m.id}`} className="group block">
                <PaperCard className="flex items-start gap-4 transition group-hover:-translate-y-0.5">
                  {m.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.posterUrl}
                      alt=""
                      className="h-16 w-28 flex-none rounded-lg object-cover"
                    />
                  ) : (
                    <span className="grid h-16 w-28 flex-none place-items-center rounded-lg bg-paper-2 text-2xl">
                      🎬
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-medium text-ink">🎬 {m.title}</p>
                    {m.subtitle ? <p className="text-sm text-ink-soft">{m.subtitle}</p> : null}
                    <p className="mt-1 font-mono text-[11px] text-ink-faint">
                      {formatDateLabel(m.watchedDate)} · {m.minutes} min · 💬 {m.messageCount} · ❤️{" "}
                      {m.reactionCount}
                    </p>
                    {m.note ? (
                      <p className="mt-2 font-hand text-lg text-accent-ink">
                        &ldquo;{m.note}&rdquo;
                      </p>
                    ) : null}
                  </div>
                </PaperCard>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <div className="text-center">
        <Link href="/watch" className="text-sm text-ink-faint hover:text-ink-soft">
          ← Watch Together
        </Link>
      </div>
    </div>
  );
}
