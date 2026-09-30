import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { formatDateLabel } from "@/lib/date";
import { getWatchMemory } from "@/lib/watch/queries";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { MemoryActions } from "./memory-actions";

export const metadata: Metadata = { title: "Watched Together" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 💾 One Watch Memory — the little card a night together leaves behind.
 *
 * This route is deliberately last in line: /watch/create, /watch/join,
 * /watch/room and /watch/history are static segments and win over it, so only
 * an id ever lands here (and anything that isn't one is a 404).
 */
export default async function WatchMemoryPage({
  params,
}: {
  params: Promise<{ watchId: string }>;
}) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { watchId } = await params;
  if (!UUID_RE.test(watchId)) notFound();

  const [memory, partner] = await Promise.all([
    getWatchMemory(watchId),
    getPartner(ctx.spaceId, ctx.userId),
  ]);
  if (!memory) notFound();

  const you = ctx.profile.nickname || ctx.profile.display_name;
  const them = partner?.name ?? "Dia";

  return (
    <div className="flex flex-col gap-6">
      <PaperCard lift className="overflow-hidden bg-gradient-to-br from-blush/40 to-paper text-center">
        <Eyebrow>🍿 watched together</Eyebrow>

        {memory.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={memory.posterUrl}
            alt=""
            className="mx-auto mt-4 aspect-video w-full max-w-sm rounded-xl object-cover"
          />
        ) : null}

        <h1 className="mt-4 font-display text-2xl font-medium text-ink text-balance">
          {memory.title}
        </h1>
        {memory.subtitle ? <p className="mt-1 text-ink-soft">{memory.subtitle}</p> : null}

        <p className="mt-4 font-mono text-xs tracking-[0.14em] text-ink-faint uppercase">
          {formatDateLabel(memory.watchedDate)}
        </p>
        <p className="mt-2 text-ink">
          <span className="text-accent-ink">{memory.minutes}</span> min together
        </p>

        <div className="mt-4 flex items-center justify-center gap-5 font-mono text-xs text-ink-faint">
          <span>💬 {memory.messageCount} messages</span>
          <span>❤️ {memory.reactionCount} reactions</span>
        </div>

        {memory.note ? (
          <p className="mx-auto mt-6 max-w-sm font-hand text-2xl text-accent-ink text-balance">
            &ldquo;{memory.note}&rdquo;
          </p>
        ) : null}

        <p className="mt-6 font-display text-lg text-ink">
          {you} <span className="text-accent-ink">♡</span> {them}
        </p>
      </PaperCard>

      <MemoryActions memoryId={memory.id} initialNote={memory.note} />

      {memory.sourceUrl ? (
        <p className="text-center text-xs text-ink-faint">
          <a
            href={memory.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-ink-soft hover:underline"
          >
            Buka tontonannya lagi ↗
          </a>
        </p>
      ) : null}

      <div className="flex items-center justify-center gap-5 text-sm">
        <Link href="/watch/history" className="text-accent-ink hover:underline">
          📚 Things we watched
        </Link>
        <Link href="/watch" className="text-ink-faint hover:text-ink-soft">
          🍿 Watch Together
        </Link>
      </div>
    </div>
  );
}
