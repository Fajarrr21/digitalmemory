import Link from "next/link";
import { getSpaceContext, getPartner } from "@/lib/auth";
import { getAwayStatus, isJustBack, countOwnMoments } from "@/lib/meanwhile";
import { formatDateLabel, localDateISO } from "@/lib/date";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { Meanwhile } from "./meanwhile";
import { AwayControl } from "./away-control";
import { collectionLine } from "./meanwhile-config";

export const metadata = { title: "Meanwhile…" };

export default async function MeanwhilePage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const [selfAway, partnerAway, momentCount] = await Promise.all([
    getAwayStatus(ctx.spaceId, ctx.userId),
    partner ? getAwayStatus(ctx.spaceId, partner.id) : Promise.resolve(null),
    countOwnMoments(ctx.userId),
  ]);

  const today = localDateISO(ctx.profile.timezone);
  const line = collectionLine(momentCount);

  return (
    <div className="flex flex-col gap-6">
      <Meanwhile
        spaceId={ctx.spaceId}
        userId={ctx.userId}
        partnerName={partner?.name ?? "aku"}
        partnerAway={
          partnerAway
            ? {
                kind: partnerAway.kind,
                active: partnerAway.active,
                justBack: isJustBack(partnerAway),
              }
            : null
        }
        todayISO={today}
        dateLabel={formatDateLabel(today)}
      />

      <section className="flex flex-col gap-2">
        <Eyebrow>i&apos;m away</Eyebrow>
        <PaperCard>
          <AwayControl
            current={selfAway ? { kind: selfAway.kind, active: selfAway.active } : null}
          />
        </PaperCard>
      </section>

      <Link href="/meanwhile/archive" className="group block">
        <PaperCard className="transition group-hover:-translate-y-0.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Eyebrow>little collection</Eyebrow>
              <p className="mt-2 font-display text-lg font-medium text-ink">
                {momentCount > 0 ? `${momentCount} little moments` : "Nothing here yet."}
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {line ?? (momentCount > 0
                  ? "Serpihan kecil dari hari-hari biasa."
                  : "Maybe today can be the first little piece.")}
              </p>
            </div>
            <span aria-hidden className="text-2xl opacity-40 transition group-hover:opacity-70">
              🌙
            </span>
          </div>
        </PaperCard>
      </Link>
    </div>
  );
}
