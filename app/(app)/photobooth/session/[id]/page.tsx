import type { Metadata } from "next";
import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getFlameData } from "@/lib/flame";
import { formatDateLabel, localDateISO } from "@/lib/date";
import { PaperCard } from "@/components/ui/paper-card";
import { getBoothState } from "../../actions";
import { DuoBooth } from "./duo-booth";

export const metadata: Metadata = { title: "A Little Photo Booth" };

/**
 * A Both-of-Us session. The URL *is* the invitation: the creator shares this
 * link, the partner opens it (middleware sends a signed-out visitor through
 * /sign-in?next=… and back), and RLS keeps non-members out entirely.
 */
export default async function BoothSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { id } = await params;
  const initial = await getBoothState(id);

  if (!initial.ok || !initial.session) {
    return (
      <PaperCard className="text-center">
        <p className="text-3xl">📸</p>
        <p className="mt-3 font-display text-xl font-medium text-ink">
          Photobooth ini tidak ditemukan
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Mungkin linknya salah, atau boothnya sudah ditutup.
        </p>
        <Link href="/photobooth" className="mt-4 inline-block text-sm text-accent-ink hover:underline">
          Buka photobooth baru →
        </Link>
      </PaperCard>
    );
  }

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const flame = await getFlameData(ctx.spaceId, ctx.userId, partner?.id ?? null, ctx.profile.timezone);
  const bestFlameDay = Math.max(flame.state.streak, ...flame.state.runs.map((r) => r.length), 0);
  const today = localDateISO(ctx.profile.timezone);

  return (
    <DuoBooth
      initial={initial.session}
      spaceId={ctx.spaceId}
      selfId={ctx.userId}
      dateISO={today}
      dateLabel={formatDateLabel(today)}
      bestFlameDay={bestFlameDay}
    />
  );
}
