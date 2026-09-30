import type { Metadata } from "next";
import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getRoom, isRoomAlive } from "@/lib/watch/queries";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { sourceNote } from "../../watch-config";
import { JoinRoom } from "./join-room";

export const metadata: Metadata = { title: "Watch Together" };

/**
 * The invitation. The token IS the room id — unguessable, and RLS restricts
 * every read to the two of you, so a link that wanders off shows nothing. A
 * signed-out partner is bounced through /sign-in?next=… by the proxy and lands
 * back here.
 */
export default async function JoinWatchPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { token } = await params;
  const room = await getRoom(token);

  if (!room || room.spaceId !== ctx.spaceId) {
    return (
      <Closed
        title="Undangan ini nggak ditemukan"
        body="Mungkin linknya salah, atau roomnya sudah ditutup."
      />
    );
  }
  if (room.status === "ended") {
    return (
      <Closed
        title="Nontonnya sudah selesai"
        body="Room ini sudah ditutup. Buka yang baru kapan-kapan ya. ♡"
      />
    );
  }
  if (!isRoomAlive(room)) {
    return (
      <Closed
        title="Undangan ini sudah kedaluwarsa"
        body="Room yang nggak pernah dibuka akan menutup sendiri setelah 24 jam. Minta link baru ya. ♡"
      />
    );
  }

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const alreadyIn = room.hostId === ctx.userId || room.guestId === ctx.userId;
  const inviterName = room.hostId === ctx.userId ? "Kamu" : (partner?.name ?? "Dia");
  const full = !!room.guestId && !alreadyIn;

  if (full) {
    return (
      <Closed title="Room ini sudah penuh" body="Satu room untuk dua orang — dan sudah ada dua." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-4xl">🍿</p>
        <p className="mt-3 font-hand text-2xl text-accent-ink">
          {inviterName} invited you to watch something together. ♡
        </p>
      </div>

      <PaperCard className="text-center">
        <Eyebrow>🎬 tontonan malam ini</Eyebrow>
        <p className="mt-3 font-display text-xl font-medium text-ink text-balance">{room.title}</p>
        {room.subtitle ? <p className="mt-1 text-ink-soft">{room.subtitle}</p> : null}
        <p className="mt-4 text-xs text-ink-soft">{sourceNote(room.sourceKind)}</p>
        <div className="mt-5">
          <JoinRoom roomId={room.id} alreadyIn={alreadyIn} />
        </div>
      </PaperCard>

      <div className="text-center">
        <Link href="/watch" className="text-sm text-ink-faint hover:text-ink-soft">
          ← Watch Together
        </Link>
      </div>
    </div>
  );
}

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <PaperCard className="text-center">
      <p className="text-3xl">🍿</p>
      <p className="mt-3 font-display text-xl font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{body}</p>
      <Link href="/watch" className="mt-4 inline-block text-sm text-accent-ink hover:underline">
        Buka room baru →
      </Link>
    </PaperCard>
  );
}
