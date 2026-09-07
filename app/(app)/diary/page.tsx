import Link from "next/link";
import { getSpaceContext, getPartner } from "@/lib/auth";
import { getTimeline } from "@/lib/timeline";
import { formatDateLabel } from "@/lib/date";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { MemoryCard } from "@/components/memory/memory-card";
import { PersonToggle } from "@/components/person-toggle";

const PAGE = 14;

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ take?: string; who?: string }>;
}) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { take: takeParam, who } = await searchParams;
  const take = Math.min(Math.max(Number(takeParam) || PAGE, PAGE), 400);

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const viewingPartner = who === "partner" && !!partner;
  const targetId = viewingPartner ? partner!.id : ctx.userId;
  const suffix = viewingPartner ? "?who=partner" : "";

  const { days, hasMore } = await getTimeline(targetId, take);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>your days, one after another</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-medium text-ink">Diary</h1>
        </div>
        {partner ? (
          <PersonToggle
            selfHref="/diary"
            partnerHref="/diary?who=partner"
            partnerName={partner.name}
            viewingPartner={viewingPartner}
          />
        ) : null}
      </div>

      {days.length === 0 ? (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-xl text-accent-ink">
            {viewingPartner ? `${partner!.name} belum nulis apa-apa` : "looks like today hasn't been written yet"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {viewingPartner
              ? "Nanti kalau dia ngisi hari, muncul di sini."
              : "Rate a day or keep a memory, and it'll start filling in here."}
          </p>
        </PaperCard>
      ) : (
        <div className="flex flex-col gap-9">
          {days.map((day) => (
            <section key={day.date} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule-soft pb-2">
                <Link
                  href={`/diary/${day.date}${suffix}`}
                  className="font-display text-lg font-medium text-ink hover:text-accent-ink"
                >
                  {formatDateLabel(day.date)}
                </Link>
                {day.rating ? (
                  <span className="rounded-full bg-blush/50 px-2.5 py-0.5 text-xs font-medium text-accent-ink">
                    {day.rating.score}/10{day.rating.mood ? ` · ${day.rating.mood}` : ""}
                  </span>
                ) : null}
                {day.letterStatus ? (
                  <span className="text-sm" title={`letter ${day.letterStatus}`}>💌</span>
                ) : null}
              </div>

              {day.memories.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {day.memories.map((m) => (
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
                </div>
              ) : (
                <p className="text-sm text-ink-faint">
                  {day.rating ? "Cuma rating hari ini." : "Ada surat hari ini."}
                </p>
              )}
            </section>
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Link
            href={`/diary?take=${take + PAGE}${viewingPartner ? "&who=partner" : ""}`}
            className="rounded-full border border-rule px-5 py-2.5 text-sm text-ink-soft transition hover:border-accent-ink/40 hover:text-accent-ink"
          >
            Muat lebih banyak
          </Link>
        </div>
      ) : null}
    </div>
  );
}
