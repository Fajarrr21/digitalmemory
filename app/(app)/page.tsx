import Link from "next/link";
import { getSpaceContext } from "@/lib/auth";
import { formatDateLabel, localDateISO } from "@/lib/date";
import { resolveDailyLetter } from "@/lib/letters";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";

export default async function HomePage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null; // layout handles the pre-setup state

  const today = localDateISO(ctx.profile.timezone);
  const resolved = await resolveDailyLetter(ctx.spaceId, ctx.userId);

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
            <p className="mt-3 font-display text-lg font-medium text-ink">
              Rate today
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              A number, and the why behind it.
            </p>
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

      {/* Today's memories — empty state for now (wired up in Phase 3) */}
      <section className="mt-2">
        <Eyebrow>today&apos;s little moments</Eyebrow>
        <PaperCard className="mt-3 border-dashed text-center">
          <p className="font-hand text-xl text-accent-ink">
            this little page is waiting for a memory
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Whenever something happens worth keeping — it goes here.
          </p>
        </PaperCard>
      </section>
    </div>
  );
}
