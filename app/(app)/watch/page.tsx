import type { Metadata } from "next";
import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { formatDateLabel } from "@/lib/date";
import { getLiveRoom, getWatchMemories } from "@/lib/watch/queries";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Button } from "@/components/ui/button";
import { WATCH_INVITATION, WATCH_TAGLINE } from "./watch-config";

export const metadata: Metadata = { title: "Watch Together" };

/**
 * 🍿 Watch Together — the landing. If something is already on, this page's job
 * is to get you into it in one tap; otherwise it's an open invitation.
 */
export default async function WatchPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const [live, partner, recent] = await Promise.all([
    getLiveRoom(ctx.spaceId),
    getPartner(ctx.spaceId, ctx.userId),
    getWatchMemories(ctx.spaceId, 4),
  ]);

  const iAmIn = live && (live.hostId === ctx.userId || live.guestId === ctx.userId);
  const waitingForMe = live && live.hostId !== ctx.userId && !live.guestId;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <Eyebrow>🍿 watch together</Eyebrow>
        <h1 className="mt-3 font-display text-3xl font-medium text-ink text-balance sm:text-4xl">
          {WATCH_TAGLINE}
        </h1>
      </div>

      {live ? (
        <PaperCard lift className="bg-gradient-to-br from-blush/40 to-paper text-center">
          <Eyebrow>
            {waitingForMe
              ? `${partner?.name ?? "Dia"} is waiting for you. ♡`
              : iAmIn
                ? "room kalian masih terbuka"
                : "ada yang sedang diputar"}
          </Eyebrow>
          <p className="mt-3 font-display text-xl font-medium text-ink text-balance">
            🎬 {live.title}
          </p>
          {live.subtitle ? <p className="mt-1 text-ink-soft">{live.subtitle}</p> : null}
          <div className="mt-5">
            <Link href={iAmIn ? `/watch/room/${live.id}` : `/watch/join/${live.id}`}>
              <Button type="button">{iAmIn ? "Kembali ke room →" : "Join room →"}</Button>
            </Link>
          </div>
        </PaperCard>
      ) : (
        <PaperCard className="text-center">
          {WATCH_INVITATION.map((line) => (
            <p key={line} className="font-display text-lg font-medium text-ink">
              {line}
            </p>
          ))}
          <p className="mt-3 font-hand text-xl text-accent-ink">
            bawa apa aja — kita tontonin bareng ♡
          </p>
          <div className="mt-5">
            <Link href="/watch/create">
              <Button type="button">Start watching →</Button>
            </Link>
          </div>
        </PaperCard>
      )}

      {live ? (
        <p className="text-center text-xs text-ink-faint">
          Satu room, satu tontonan.{" "}
          <Link href="/watch/create" className="text-accent-ink hover:underline">
            Ganti tontonan
          </Link>{" "}
          akan menutup room yang sekarang.
        </p>
      ) : null}

      {/* Recently watched */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Eyebrow>things we watched</Eyebrow>
          <Link href="/watch/history" className="text-xs text-accent-ink hover:underline">
            semua →
          </Link>
        </div>

        {recent.length === 0 ? (
          <PaperCard className="border-dashed text-center">
            <p className="font-hand text-xl text-accent-ink">belum ada yang kita tonton bareng</p>
            <p className="mt-1 text-sm text-ink-soft">
              Yang pertama akan tersimpan di sini setelah selesai. ♡
            </p>
          </PaperCard>
        ) : (
          <ul className="flex flex-col gap-3">
            {recent.map((m) => (
              <li key={m.id}>
                <Link href={`/watch/${m.id}`} className="group block">
                  <PaperCard className="flex items-center gap-4 transition group-hover:-translate-y-0.5">
                    {m.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.posterUrl}
                        alt=""
                        className="h-14 w-24 flex-none rounded-lg object-cover"
                      />
                    ) : (
                      <span className="grid h-14 w-24 flex-none place-items-center rounded-lg bg-paper-2 text-xl">
                        🎬
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-medium text-ink">
                        {m.title}
                      </p>
                      {m.subtitle ? (
                        <p className="truncate text-sm text-ink-soft">{m.subtitle}</p>
                      ) : null}
                      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                        {formatDateLabel(m.watchedDate)} · {m.minutes} min
                      </p>
                    </div>
                  </PaperCard>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center font-hand text-lg text-accent-ink">
        you bring the video. we make it a moment together. 🍿♡
      </p>
    </div>
  );
}
