import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpaceContext, getPartner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDayActivities } from "@/lib/activities";
import { formatDateLabel } from "@/lib/date";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { MemoryCard } from "@/components/memory/memory-card";
import { bandLabel } from "../../today/rating-config";

export default async function DayDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ who?: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { who } = await searchParams;
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const viewingPartner = who === "partner" && !!partner;
  const targetId = viewingPartner ? partner!.id : ctx.userId;

  const supabase = await createClient();
  const [{ data: rating }, { data: letter }, memories] = await Promise.all([
    supabase
      .from("daily_ratings")
      .select("score, mood, reason, note")
      .eq("user_id", targetId)
      .eq("rating_date", date)
      .maybeSingle(),
    supabase
      .from("daily_letters")
      .select("category, title, body, status")
      .eq("recipient_id", targetId)
      .eq("letter_date", date)
      .maybeSingle(),
    getDayActivities(targetId, date),
  ]);

  const empty = !rating && !letter && memories.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={viewingPartner ? "/diary?who=partner" : "/diary"}
          className="text-sm text-accent-ink hover:underline"
        >
          ← Diary
        </Link>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">
          {formatDateLabel(date)}
        </h1>
        {viewingPartner ? (
          <p className="mt-1 font-mono text-sm text-ink-faint">harinya {partner!.name}</p>
        ) : null}
      </div>

      {empty ? (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-xl text-accent-ink">this little page is empty</p>
          <p className="mt-1 text-sm text-ink-soft">Nothing was written on this day.</p>
        </PaperCard>
      ) : null}

      {rating ? (
        <section className="flex flex-col gap-2">
          <Eyebrow>the feeling</Eyebrow>
          <PaperCard>
            <p className="font-display text-lg font-medium text-ink">
              {bandLabel(rating.score)} ·{" "}
              <span className="text-accent-ink">{rating.score}/10</span>
              {rating.mood ? <span className="text-ink-soft"> · {rating.mood}</span> : null}
            </p>
            {rating.reason ? <p className="mt-2 leading-relaxed text-ink-soft">{rating.reason}</p> : null}
            {rating.note ? <p className="mt-1 text-sm text-ink-faint">{rating.note}</p> : null}
          </PaperCard>
        </section>
      ) : null}

      {memories.length > 0 ? (
        <section className="flex flex-col gap-3">
          <Eyebrow>the moments</Eyebrow>
          {memories.map((m) => (
            <MemoryCard
              key={m.id}
              id={m.id}
              title={m.title}
              description={m.description}
              location={m.location}
              media={m.media}
              canDelete={!viewingPartner}
            />
          ))}
        </section>
      ) : null}

      {letter ? (
        <section className="flex flex-col gap-2">
          <Eyebrow>the letter</Eyebrow>
          <PaperCard lift className="bg-gradient-to-br from-blush/40 to-paper">
            {letter.status === "opened" ? (
              <>
                {letter.title ? (
                  <h2 className="mb-2 font-display text-xl font-medium text-ink">{letter.title}</h2>
                ) : null}
                <p className="whitespace-pre-line font-display text-[1.05rem] leading-[1.8] text-ink">
                  {letter.body}
                </p>
                <p className="mt-4 text-right font-hand text-lg text-accent-ink">— untukmu ♡</p>
              </>
            ) : (
              <p className="text-ink-soft">
                Ada surat untuk hari ini yang belum dibuka.{" "}
                <Link href="/letter" className="text-accent-ink hover:underline">
                  Buka →
                </Link>
              </p>
            )}
          </PaperCard>
        </section>
      ) : null}
    </div>
  );
}
