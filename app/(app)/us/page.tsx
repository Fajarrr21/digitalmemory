import Link from "next/link";
import { getSpaceContext } from "@/lib/auth";
import { getOurMemories } from "@/lib/our-memories";
import { getWatchMemories } from "@/lib/watch/queries";
import { formatDateLabel } from "@/lib/date";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { MemoryComposer } from "./memory-composer";
import { MemoryNode } from "./memory-node";

export default async function UsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const [memories, watched] = await Promise.all([
    getOurMemories(ctx.spaceId),
    getWatchMemories(ctx.spaceId, 3),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <Eyebrow>the beginning → today</Eyebrow>
        <h1 className="mt-3 font-display text-3xl font-medium text-ink text-balance sm:text-4xl">
          Our Little Universe
        </h1>
        <p className="mt-2 font-hand text-xl text-accent-ink">tempat kenangan kita disimpan ♡</p>
      </div>

      {memories.length === 0 ? (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-xl text-accent-ink">the story starts here</p>
          <p className="mt-1 text-sm text-ink-soft">
            Tambah kenangan pertama kalian di bawah — momen yang pengen kalian simpan berdua.
          </p>
        </PaperCard>
      ) : (
        <ol className="relative ml-2 flex flex-col gap-10 border-l-2 border-rule pl-7">
          <li className="relative">
            <Dot />
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">the beginning</p>
          </li>

          {memories.map((m) => (
            <li key={m.id} className="relative">
              <Dot filled={m.is_featured} />
              <MemoryNode
                id={m.id}
                title={m.title}
                description={m.description}
                dateLabel={m.memory_date ? formatDateLabel(m.memory_date) : null}
                media={m.media}
                canDelete
              />
            </li>
          ))}

          <li className="relative">
            <Dot />
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">today, and onward</p>
          </li>
        </ol>
      )}

      {/* 🍿 Nights we spent watching something together — kept over in
          /watch/history, shown here because they belong to us too. */}
      {watched.length > 0 ? (
        <section className="flex flex-col gap-3 border-t border-rule-soft pt-6">
          <div className="flex items-center justify-between">
            <Eyebrow>🍿 things we watched</Eyebrow>
            <Link href="/watch/history" className="text-xs text-accent-ink hover:underline">
              semua →
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {watched.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/watch/${w.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-rule bg-paper px-4 py-3 text-sm transition hover:border-accent-ink/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-ink">🎬 {w.title}</span>
                    <span className="font-mono text-[11px] text-ink-faint">
                      {formatDateLabel(w.watchedDate)} · {w.minutes} min
                    </span>
                  </span>
                  <span className="flex-none text-ink-faint">♡</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="border-t border-rule-soft pt-6">
        <MemoryComposer spaceId={ctx.spaceId} ownerId={ctx.userId} />
      </div>
    </div>
  );
}

/** The node marker sitting on the trail line. */
function Dot({ filled = false }: { filled?: boolean }) {
  return (
    <span
      className={`absolute -left-[35px] top-1 h-3.5 w-3.5 rounded-full border-2 border-accent ${
        filled ? "bg-accent" : "bg-ground"
      }`}
      aria-hidden
    />
  );
}
