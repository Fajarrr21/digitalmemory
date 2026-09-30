import Link from "next/link";
import { getSpaceContext, getPartner } from "@/lib/auth";
import { getAwayStatus, isJustBack } from "@/lib/meanwhile";
import { getFlameData } from "@/lib/flame";
import { signPaths } from "@/lib/media";
import { MilestoneCelebration } from "@/components/flame/milestone-celebration";
import { awayInfo } from "./meanwhile/meanwhile-config";
import { formatDateLabel, localDateISO, localHour } from "@/lib/date";
import { daypart } from "@/lib/greeting";
import { resolveDailyLetter } from "@/lib/letters";
import { getDayActivities } from "@/lib/activities";
import { getForYouMessages } from "@/lib/for-you";
import { getTasks } from "@/lib/tasks/queries";
import { dueLabel, upcomingTasks } from "@/lib/tasks/logic";
import { getLiveRoom } from "@/lib/watch/queries";
import { WATCH_INVITATION } from "./watch/watch-config";
import { createClient } from "@/lib/supabase/server";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { MemoryCard } from "@/components/memory/memory-card";
import { encouragementFor } from "./today/rating-config";

export default async function HomePage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null; // layout handles the pre-setup state

  const today = localDateISO(ctx.profile.timezone);
  const resolved = await resolveDailyLetter(ctx.spaceId, ctx.userId);

  const supabase = await createClient();
  const [{ data: rating }, memories, forYou, partner] = await Promise.all([
    supabase
      .from("daily_ratings")
      .select("score")
      .eq("user_id", ctx.userId)
      .eq("rating_date", today)
      .maybeSingle(),
    getDayActivities(ctx.userId, today),
    getForYouMessages(ctx.spaceId),
    getPartner(ctx.spaceId, ctx.userId),
  ]);
  const partnerAway = partner ? await getAwayStatus(ctx.spaceId, partner.id) : null;

  // Little Things: what's still waiting on YOU (yours + the shared ones).
  const memberIds = [ctx.userId, ...(partner ? [partner.id] : [])];
  const coming = upcomingTasks(await getTasks(ctx.spaceId), memberIds, today).filter(
    (t) => t.assignedTo === null || t.assignedTo === ctx.userId,
  );

  // Our Little Flame: milestone popup data (photos + streak) for this visit.
  const flame = await getFlameData(
    ctx.spaceId,
    ctx.userId,
    partner?.id ?? null,
    ctx.profile.timezone,
  );
  const { data: partnerProfile } = partner
    ? await supabase.from("profiles").select("avatar_path").eq("id", partner.id).maybeSingle()
    : { data: null };
  const avatarPaths = [ctx.profile.avatar_path, partnerProfile?.avatar_path].filter(
    (p): p is string => !!p,
  );
  const signedAvatars = await signPaths(avatarPaths);

  // The Meanwhile card adapts to the partner's manual away status.
  let meanwhileEyebrow = "meanwhile…";
  let meanwhileTitle = "Something is waiting for you.";
  let meanwhileSub = "We're probably doing our own things right now.";
  if (partner && partnerAway?.active) {
    const info = awayInfo(partnerAway.kind);
    meanwhileEyebrow = `${info.emoji} ${partner.name} ${info.doing}`;
    meanwhileTitle = "Meanwhile, there's something for you.";
    meanwhileSub = "Go have your own little moment. ♡";
  } else if (partner && isJustBack(partnerAway)) {
    meanwhileEyebrow = `${partner.name} is back ♡`;
    meanwhileTitle = "Did you have your little moment?";
    meanwhileSub = "There's still something waiting, if not.";
  }

  // Watch Together: if something is already on, the card becomes a way in.
  const liveRoom = await getLiveRoom(ctx.spaceId);
  const inRoom = !!liveRoom && (liveRoom.hostId === ctx.userId || liveRoom.guestId === ctx.userId);
  const roomWaitsForMe = !!liveRoom && liveRoom.hostId !== ctx.userId && !liveRoom.guestId;

  const isEvening = ["evening", "night"].includes(daypart(localHour(ctx.profile.timezone)));
  const unopenedForYou =
    ctx.role === "keeper" ? forYou.filter((m) => m.opened_at === null).length : 0;
  const showReflect = isEvening;

  // Copy for the letter card, tuned to who's looking and whether it's been read.
  let letterEyebrow = "a letter is waiting";
  let letterTitle = "You have a letter today.";
  let letterSub = "Open it when you're ready. ♡";
  if (resolved) {
    if (!resolved.isRecipient) {
      letterEyebrow = "for her";
      letterTitle = "Today's letter is ready.";
      letterSub = "She'll find it waiting when she opens her day.";
    } else if (resolved.letter.status === "opened") {
      letterEyebrow = "today's letter";
      letterTitle = "You've read today's letter.";
      letterSub = "Want to read it once more? ♡";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <MilestoneCelebration
        streak={flame.state.streak}
        youName={ctx.profile.nickname || ctx.profile.display_name}
        partnerName={partner?.name ?? "Dia"}
        youAvatarUrl={
          ctx.profile.avatar_path ? (signedAvatars[ctx.profile.avatar_path] ?? null) : null
        }
        partnerAvatarUrl={
          partnerProfile?.avatar_path
            ? (signedAvatars[partnerProfile.avatar_path] ?? null)
            : null
        }
      />

      <p className="font-mono text-sm text-ink-faint">{formatDateLabel(today)}</p>

      {/* Daily Letter — the first thing she should reach for */}
      <Link href="/letter" className="group block">
        <PaperCard
          lift
          className="relative overflow-hidden bg-gradient-to-br from-blush/50 to-paper transition group-hover:-translate-y-0.5"
        >
          <Eyebrow>{letterEyebrow}</Eyebrow>
          <p className="mt-3 font-display text-2xl font-medium text-ink text-balance">
            {letterTitle}
          </p>
          <p className="mt-1 text-ink-soft">{letterSub}</p>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-3 -bottom-3 text-7xl opacity-15 transition group-hover:scale-105"
          >
            💌
          </span>
        </PaperCard>
      </Link>

      {/* Today's feeling + memory */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/today" className="group block">
          <PaperCard className="h-full transition group-hover:-translate-y-0.5">
            <Eyebrow>how was your day?</Eyebrow>
            {rating ? (
              <>
                <p className="mt-3 font-display text-lg font-medium text-ink">
                  Today · <span className="text-accent-ink">{rating.score}</span>/10
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {encouragementFor(rating.score, today)}
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 font-display text-lg font-medium text-ink">Rate today</p>
                <p className="mt-1 text-sm text-ink-soft">A number, and the why behind it.</p>
              </>
            )}
          </PaperCard>
        </Link>

        <Link href="/today" className="group block">
          <PaperCard className="h-full transition group-hover:-translate-y-0.5">
            <Eyebrow>keep something</Eyebrow>
            <p className="mt-3 font-display text-lg font-medium text-ink">
              Add a memory
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              A photo, a video, a little story.
            </p>
          </PaperCard>
        </Link>
      </div>

      {/* Little Things — so you don't have to keep everything in your head */}
      <Link href={coming.length > 0 ? "/tasks" : "/tasks?new=1"} className="group block">
        <PaperCard className="relative overflow-hidden transition group-hover:-translate-y-0.5">
          <Eyebrow>📝 little things</Eyebrow>
          {coming.length > 0 ? (
            <>
              <p className="mt-3 font-display text-lg font-medium text-ink">
                {coming.length === 1
                  ? "One thing coming up"
                  : `${coming.length} things coming up`}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-soft">
                {coming.slice(0, 3).map((t) => (
                  <li key={t.id} className="flex items-baseline gap-2">
                    <span className="truncate">
                      • {t.emoji ?? "📝"} {t.title}
                    </span>
                    <span className="flex-none font-mono text-[11px] text-ink-faint">
                      {dueLabel(t.dueDate, today)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-accent-ink">See what&apos;s coming →</p>
            </>
          ) : (
            <>
              <p className="mt-3 font-display text-lg font-medium text-ink">
                Nothing waiting for you. ♡
              </p>
              <p className="mt-1 text-sm text-ink-soft">Add something →</p>
            </>
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-2 -bottom-3 text-6xl opacity-10 transition group-hover:scale-105"
          >
            📝
          </span>
        </PaperCard>
      </Link>

      {/* Meanwhile — a little something while we're doing our own things */}
      <Link href="/meanwhile" className="group block">
        <PaperCard className="relative overflow-hidden transition group-hover:-translate-y-0.5">
          <Eyebrow>{meanwhileEyebrow}</Eyebrow>
          <p className="mt-3 font-display text-lg font-medium text-ink">{meanwhileTitle}</p>
          <p className="mt-1 text-sm text-ink-soft">{meanwhileSub}</p>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-2 -bottom-3 text-6xl opacity-10 transition group-hover:scale-105"
          >
            🌙
          </span>
        </PaperCard>
      </Link>

      {/* A Little Photo Booth */}
      <Link href="/photobooth" className="group block">
        <PaperCard className="relative overflow-hidden transition group-hover:-translate-y-0.5">
          <Eyebrow>📸 a little photo booth</Eyebrow>
          <p className="mt-3 font-display text-lg font-medium text-ink">
            A little place to make a little memory.
          </p>
          <p className="mt-1 text-sm text-ink-soft">Step inside →</p>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-2 -bottom-3 text-6xl opacity-10 transition group-hover:scale-105"
          >
            📸
          </span>
        </PaperCard>
      </Link>

      {/* 🍿 Watch Together — one room, one watching, two people */}
      <Link
        href={
          liveRoom
            ? inRoom
              ? `/watch/room/${liveRoom.id}`
              : `/watch/join/${liveRoom.id}`
            : "/watch"
        }
        className="group block"
      >
        <PaperCard
          className={
            liveRoom
              ? "relative overflow-hidden bg-gradient-to-br from-blush/40 to-paper transition group-hover:-translate-y-0.5"
              : "relative overflow-hidden transition group-hover:-translate-y-0.5"
          }
        >
          {liveRoom ? (
            <>
              <Eyebrow>
                {roomWaitsForMe
                  ? `🍿 ${partner?.name ?? "Dia"} is waiting for you. ♡`
                  : "🍿 room kalian masih terbuka"}
              </Eyebrow>
              <p className="mt-3 font-display text-lg font-medium text-ink text-balance">
                🎬 {liveRoom.title}
              </p>
              {liveRoom.subtitle ? (
                <p className="mt-1 text-sm text-ink-soft">{liveRoom.subtitle}</p>
              ) : null}
              <p className="mt-3 text-sm text-accent-ink">
                {inRoom ? "Kembali ke room →" : "Join room →"}
              </p>
            </>
          ) : (
            <>
              <Eyebrow>🍿 watch together</Eyebrow>
              <p className="mt-3 font-display text-lg font-medium text-ink">
                {WATCH_INVITATION[0]}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {WATCH_INVITATION.slice(1).join(" ")}
              </p>
              <p className="mt-3 text-sm text-accent-ink">Start watching →</p>
            </>
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-2 -bottom-3 text-6xl opacity-10 transition group-hover:scale-105"
          >
            🍿
          </span>
        </PaperCard>
      </Link>

      {/* Secondary entries */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/for-you"
          className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-rule bg-paper px-4 py-3 text-sm transition hover:border-accent-ink/40"
        >
          <span className="text-ink">For You</span>
          {unopenedForYou > 0 ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-[#4a2b30]">
              {unopenedForYou} baru
            </span>
          ) : (
            <span className="text-ink-faint">♡</span>
          )}
        </Link>
        {showReflect ? (
          <Link
            href="/reflect"
            className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-rule bg-paper px-4 py-3 text-sm transition hover:border-accent-ink/40"
          >
            <span className="text-ink">Refleksi malam</span>
            <span className="text-ink-faint">🌙</span>
          </Link>
        ) : null}
      </div>

      {/* Today's memories */}
      <section className="mt-2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Eyebrow>today&apos;s little moments</Eyebrow>
          <Link href="/today" className="text-xs text-accent-ink hover:underline">
            + add
          </Link>
        </div>
        {memories.length > 0 ? (
          memories.map((m) => (
            <MemoryCard
              key={m.id}
              id={m.id}
              title={m.title}
              description={m.description}
              location={m.location}
              media={m.media}
              canDelete
            />
          ))
        ) : (
          <PaperCard className="border-dashed text-center">
            <p className="font-hand text-xl text-accent-ink">
              this little page is waiting for a memory
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Whenever something happens worth keeping — it goes here.
            </p>
          </PaperCard>
        )}
      </section>

      {/* A little secret door — a faint bloom that opens the surprise (/bloom).
          Deliberately not in the nav; discoverable if you look closely. */}
      <Link
        href="/bloom"
        aria-label="Ada kejutan kecil"
        className="group mx-auto mt-4 mb-2 inline-flex flex-col items-center gap-1 text-center opacity-40 transition hover:opacity-100 focus-visible:opacity-100"
      >
        <span className="text-2xl transition group-hover:scale-110">🌷</span>
        <span className="font-hand text-sm text-accent-ink opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          ada kejutan…
        </span>
      </Link>
    </div>
  );
}
