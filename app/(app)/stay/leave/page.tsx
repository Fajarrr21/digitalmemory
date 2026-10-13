import type { Metadata } from "next";
import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getSentGifts } from "@/lib/stay/queries";
import { PaperCard } from "@/components/ui/paper-card";
import { GiftCreator } from "./gift-creator";

export const metadata: Metadata = { title: "leave something ♡" };

const KINDS = ["note", "voice", "object", "comfort"] as const;

export default async function LeaveGiftPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const [{ kind }, partner, sent] = await Promise.all([
    searchParams,
    getPartner(ctx.spaceId, ctx.userId),
    getSentGifts(ctx.spaceId, ctx.userId),
  ]);

  if (!sent.ready) {
    return (
      <PaperCard className="border-dashed">
        <p className="font-display text-lg text-ink">Kamarnya sedang disiapkan.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Jalankan <code className="rounded bg-paper-2 px-1 font-mono text-xs">supabase/migrations/0020_stay_my_love.sql</code>{" "}
          dulu ya. ♡
        </p>
      </PaperCard>
    );
  }
  if (!partner) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-display text-2xl text-ink">Belum ada pasangan di ruang ini.</p>
        <Link href="/stay" className="text-sm text-accent-ink hover:underline">
          ← kembali ke kamar
        </Link>
      </div>
    );
  }

  return (
    <GiftCreator
      spaceId={ctx.spaceId}
      selfId={ctx.userId}
      partnerName={partner.name}
      initialKind={KINDS.find((k) => k === kind) ?? null}
      sent={sent.gifts}
    />
  );
}
