import Link from "next/link";
import { getSpaceContext, getPartner } from "@/lib/auth";
import { getMeanwhileMoments, countOwnMoments, type MeanwhileMoment } from "@/lib/meanwhile";
import { signPaths } from "@/lib/media";
import { formatDateLabel } from "@/lib/date";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { ColoringSvg, type Fills } from "@/components/coloring/coloring-svg";
import { spotifyEmbedUrl } from "@/lib/spotify";
import { getTemplate } from "../../today/coloring-config";
import { collectionLine } from "../meanwhile-config";
import { ItemActions } from "./item-actions";

export const metadata = { title: "Meanwhile — little collection" };

const CATEGORY_EMOJI: Record<MeanwhileMoment["category"], string> = {
  question: "💭",
  pick: "🎲",
  photo: "📸",
  song: "🎧",
  creation: "🎨",
  silly: "😈",
};

export default async function MeanwhileArchivePage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const [moments, ownCount] = await Promise.all([
    getMeanwhileMoments(ctx.spaceId),
    countOwnMoments(ctx.userId),
  ]);

  // Sign every photo path in one round trip.
  const photoPaths = moments
    .filter((m) => m.category === "photo")
    .map((m) => String(m.payload.path ?? ""))
    .filter(Boolean);
  const signed = await signPaths(photoPaths);

  // Group by day, newest first (query is already ordered by created_at desc).
  const byDate = new Map<string, MeanwhileMoment[]>();
  for (const m of moments) {
    const list = byDate.get(m.momentDate) ?? [];
    list.push(m);
    byDate.set(m.momentDate, list);
  }

  const line = collectionLine(ownCount);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/meanwhile" className="text-sm text-accent-ink hover:underline">
          ← Meanwhile
        </Link>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink">Little collection</h1>
        {ownCount > 0 ? (
          <p className="mt-1 text-sm text-ink-soft">
            {ownCount} little moments{line ? ` — ${line.toLowerCase()}` : ""}
          </p>
        ) : null}
      </div>

      {moments.length === 0 ? (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-xl text-accent-ink">Nothing here yet.</p>
          <p className="mt-1 text-sm text-ink-soft">Maybe today can be the first little piece.</p>
        </PaperCard>
      ) : (
        Array.from(byDate.entries()).map(([date, items]) => (
          <section key={date} className="flex flex-col gap-3">
            <Eyebrow>{formatDateLabel(date)}</Eyebrow>
            {items.map((m) => (
              <MomentCard
                key={m.id}
                moment={m}
                own={m.userId === ctx.userId}
                partnerName={partner?.name ?? "dia"}
                signedUrl={
                  m.category === "photo" ? signed[String(m.payload.path ?? "")] : undefined
                }
              />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function MomentCard({
  moment: m,
  own,
  partnerName,
  signedUrl,
}: {
  moment: MeanwhileMoment;
  own: boolean;
  partnerName: string;
  signedUrl?: string;
}) {
  const template = m.category === "creation" ? getTemplate(String(m.payload.templateId ?? "")) : undefined;

  return (
    <PaperCard>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl">
          {CATEGORY_EMOJI[m.category]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-soft">{m.prompt}</p>

          {m.category === "question" ? (
            <p className="mt-1.5 font-hand text-xl text-ink">
              &ldquo;{String(m.payload.answer ?? "")}&rdquo;
            </p>
          ) : null}

          {m.category === "pick" || m.category === "silly" ? (
            <p className="mt-1.5 font-display text-lg font-medium text-ink">
              {m.payload.emoji && m.payload.emoji !== m.payload.choice ? (
                <span className="mr-1.5">{String(m.payload.emoji)}</span>
              ) : null}
              {String(m.payload.choice ?? "")}
              {m.payload.rating != null ? (
                <span className="text-accent-ink"> · {String(m.payload.rating)}/10</span>
              ) : null}
            </p>
          ) : null}

          {m.category === "photo" && signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt="Tiny moment"
              className="mt-2 max-h-64 w-auto rounded-xl border border-rule object-cover"
            />
          ) : null}

          {m.category === "song" && m.payload.trackId ? (
            <div className="mt-2">
              <iframe
                title={String(m.payload.title ?? "Soundtrack")}
                src={spotifyEmbedUrl(String(m.payload.trackId))}
                width="100%"
                height={80}
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                style={{ border: 0, borderRadius: 12 }}
              />
            </div>
          ) : null}

          {m.category === "creation" && template ? (
            <div className="mt-2 w-full max-w-[10rem] rounded-xl border border-rule bg-ground p-2">
              <ColoringSvg
                template={template}
                fills={(m.payload.fills ?? {}) as Fills}
                className="h-auto w-full"
              />
            </div>
          ) : null}

          {own ? (
            <ItemActions id={m.id} shared={m.shared} partnerName={partnerName} />
          ) : (
            <p className="mt-2 text-xs text-ink-faint">dari {partnerName} ♡</p>
          )}
        </div>
      </div>
    </PaperCard>
  );
}
