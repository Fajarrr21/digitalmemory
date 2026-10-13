import type { Metadata } from "next";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getStayRoom } from "@/lib/stay/queries";
import { stayWhatsAppEnabled } from "@/lib/stay/logic";
import { PaperCard } from "@/components/ui/paper-card";
import { StayRoom } from "./stay-room";

export const metadata: Metadata = { title: "stay, my love." };

/**
 * stay, my love. — your own little room. It only ever shows what was left
 * for YOU (RLS filters the rest); nothing here asks how you feel.
 */
export default async function StayPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const [room, partner] = await Promise.all([getStayRoom(ctx.spaceId, ctx.userId), getPartner(ctx.spaceId, ctx.userId)]);

  if (!room.ready) {
    return (
      <PaperCard className="border-dashed">
        <p className="font-display text-lg text-ink">Kamarnya sedang disiapkan.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Jalankan{" "}
          <code className="rounded bg-paper-2 px-1 font-mono text-xs">supabase/migrations/0020_stay_my_love.sql</code> di
          SQL editor Supabase, lalu buka lagi halaman ini. ♡
        </p>
      </PaperCard>
    );
  }

  return (
    <StayRoom
      spaceId={ctx.spaceId}
      selfId={ctx.userId}
      partnerName={partner?.name ?? "Dia"}
      hasPartner={!!partner}
      prefs={room.prefs}
      gifts={room.gifts}
      whatsappOn={stayWhatsAppEnabled(ctx.profile.notif_prefs)}
    />
  );
}
