import type { Metadata } from "next";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { localDateISO } from "@/lib/date";
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

  return (
    <BoothEntry
      spaceId={ctx.spaceId}
      userId={ctx.userId}
      partnerName={partner?.name ?? null}
      dateISO={localDateISO(ctx.profile.timezone)}
      initialFrameId={frame ?? null}
    />
  );
}
