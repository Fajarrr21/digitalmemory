import { getSpaceContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDayActivities } from "@/lib/activities";
import { getRatingVoiceUrl } from "@/lib/rating-media";
import { getColoringForRating } from "@/lib/coloring";
import { formatDateLabel, localDateISO } from "@/lib/date";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { MemoryCard } from "@/components/memory/memory-card";
import { ColoringSvg } from "@/components/coloring/coloring-svg";
import { RatingFlow } from "./rating-flow";
import { ActivityComposer } from "./activity-composer";
import { getTemplate } from "./coloring-config";

export default async function TodayPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const today = localDateISO(ctx.profile.timezone);
  const supabase = await createClient();
  const [{ data: rating }, memories] = await Promise.all([
    supabase
      .from("daily_ratings")
      .select("id, score, mood, reason, note")
      .eq("user_id", ctx.userId)
      .eq("rating_date", today)
      .maybeSingle(),
    getDayActivities(ctx.userId, today),
  ]);

  const [voiceUrl, coloring] = rating
    ? await Promise.all([getRatingVoiceUrl(rating.id), getColoringForRating(rating.id)])
    : [null, null];
  const coloringTemplate = coloring ? getTemplate(coloring.templateId) : undefined;

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
        <RatingFlow
          existing={rating ?? null}
          seed={today}
          spaceId={ctx.spaceId}
          userId={ctx.userId}
          existingVoiceUrl={voiceUrl}
          existingColoring={coloring}
        />
      </PaperCard>

      {coloring && coloringTemplate ? (
        <section className="flex flex-col gap-3">
          <Eyebrow>how today felt</Eyebrow>
          <PaperCard className="bg-gradient-to-br from-blush/25 to-paper">
            <div className="mx-auto w-full max-w-[15rem] rounded-xl border border-rule bg-ground p-3">
              <ColoringSvg
                template={coloringTemplate}
                fills={coloring.fills}
                className="h-auto w-full"
              />
            </div>
            <p className="mt-2 text-center font-hand text-lg text-accent-ink">
              a little piece of today
            </p>
          </PaperCard>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <Eyebrow>today&apos;s little moments</Eyebrow>
        <ActivityComposer
          spaceId={ctx.spaceId}
          ownerId={ctx.userId}
          todayISO={today}
          canChooseVisibility={ctx.role === "author"}
        />

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
