import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSpaceContext } from "@/lib/auth";
import { getRoom, getRoomMessages } from "@/lib/watch/queries";
import { PaperCard } from "@/components/ui/paper-card";
import { getRoomState } from "../../actions";
import { WatchRoom } from "./watch-room";

export const metadata: Metadata = { title: "Watch Together" };

/**
 * The core room. The URL is not the invitation — /watch/join/{id} is — so
 * anyone who lands here without being one of the two participants is sent
 * there to take the invite properly. RLS keeps non-members out entirely.
 */
export default async function WatchRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { id } = await params;
  const row = await getRoom(id);

  if (!row || row.spaceId !== ctx.spaceId) return <NotFound />;

  // Not yet a participant? Take the invite first.
  if (row.hostId !== ctx.userId && row.guestId !== ctx.userId) redirect(`/watch/join/${id}`);

  const [state, messages] = await Promise.all([getRoomState(id), getRoomMessages(id)]);
  if (!state.ok || !state.room) return <NotFound />;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return (
    <WatchRoom
      initial={state.room}
      initialMessages={messages.map((m) => ({
        id: m.id,
        userId: m.userId,
        body: m.body,
        replyTo: m.replyTo,
        atSeconds: m.atSeconds,
        createdAt: m.createdAt,
      }))}
      selfId={ctx.userId}
      selfName={ctx.profile.nickname || ctx.profile.display_name}
      inviteUrl={`${proto}://${host}/watch/join/${id}`}
    />
  );
}

function NotFound() {
  return (
    <PaperCard className="text-center">
      <p className="text-3xl">🍿</p>
      <p className="mt-3 font-display text-xl font-medium text-ink">Room ini nggak ditemukan</p>
      <p className="mt-1 text-sm text-ink-soft">
        Mungkin linknya salah, atau roomnya sudah ditutup.
      </p>
      <Link href="/watch" className="mt-4 inline-block text-sm text-accent-ink hover:underline">
        Buka room baru →
      </Link>
    </PaperCard>
  );
}
