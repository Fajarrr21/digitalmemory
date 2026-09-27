import type { Metadata } from "next";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getFlameData } from "@/lib/flame";
import { formatDateLabel, localDateISO } from "@/lib/date";
import { BoothEntry } from "./booth-entry";

export const metadata: Metadata = { title: "A Little Photo Booth" };

export default async function PhotoboothPage({
  searchParams,
}: {
  searchParams: Promise<{ frame?: string }>;
}) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { frame } = await searchParams;
  const partner = await getPartner(ctx.spaceId, ctx.userId);

  // Milestone frames unlock from the couple's best flame ever.
  const flame = await getFlameData(ctx.spaceId, ctx.userId, partner?.id ?? null, ctx.profile.timezone);
  const bestFlameDay = Math.max(flame.state.streak, ...flame.state.runs.map((r) => r.length), 0);

  const today = localDateISO(ctx.profile.timezone);

  return (
    <BoothEntry
      spaceId={ctx.spaceId}
      userId={ctx.userId}
      name={ctx.profile.nickname || ctx.profile.display_name}
      partnerName={partner?.name ?? null}
      dateISO={today}
      dateLabel={formatDateLabel(today)}
      bestFlameDay={bestFlameDay}
      initialFrameId={frame ?? null}
    />
  );
}
