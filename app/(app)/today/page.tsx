import { getSpaceContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDayActivities } from "@/lib/activities";
import { formatDateLabel, localDateISO } from "@/lib/date";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { MemoryCard } from "@/components/memory/memory-card";
import { RatingFlow } from "./rating-flow";
import { ActivityComposer } from "./activity-composer";

export default async function TodayPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const today = localDateISO(ctx.profile.timezone);
  const supabase = await createClient();
  const [{ data: rating }, memories] = await Promise.all([
    supabase
      .from("daily_ratings")
      .select("score, mood, reason, note")
      .eq("user_id", ctx.userId)
      .eq("rating_date", today)
      .maybeSingle(),
    getDayActivities(ctx.userId, today),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>how was your day?</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">
          {rating ? "Hari ini, sejauh ini" : "Ceritakan harimu"}
        </h1>
        <p className="mt-1 font-mono text-sm text-ink-faint">{formatDateLabel(today)}</p>
      </div>

      <PaperCard>
        <RatingFlow existing={rating ?? null} seed={today} />
      </PaperCard>

      <section className="flex flex-col gap-4">
        <Eyebrow>today&apos;s little moments</Eyebrow>
        <ActivityComposer spaceId={ctx.spaceId} ownerId={ctx.userId} todayISO={today} />

        {memories.length > 0 ? (
          <div className="flex flex-col gap-4">
            {memories.map((m) => (
              <MemoryCard
                key={m.id}
                id={m.id}
                title={m.title}
                description={m.description}
                location={m.location}
                media={m.media}
                canDelete
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-ink-faint">
            Belum ada momen hari ini. Simpan satu kalau ada yang ingin kamu ingat. ♡
          </p>
        )}
      </section>
    </div>
  );
}
