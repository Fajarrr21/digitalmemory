import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getHoldSession } from "@/lib/hold/queries";
import { formatInstant } from "@/lib/date";
import { HoldSessionView } from "./hold-session";

export const metadata: Metadata = { title: "Hold" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One Hold session. The sender sees their own space (and what they kept
 * private, which RLS never returns to anyone else); the recipient sees
 * "Let Me Hold It". Anyone else — or a deleted session — gets a gentle 404,
 * because RLS returns no row at all.
 */
export default async function HoldSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  let detail = await getHoldSession(id);
  if (!detail) return <Gone />;

  const viewer = detail.session.sender_id === ctx.userId ? "sender" : "recipient";

  // Arriving is the "open". Idempotent in the database (pending → opened only).
  if (viewer === "recipient" && detail.session.status === "pending") {
    const supabase = await createClient();
    await supabase.rpc("hold_open", { p_session: id });
    detail = (await getHoldSession(id)) ?? detail;
  }

  const partner = await getPartner(ctx.spaceId, ctx.userId);

  return (
    <HoldSessionView
      viewer={viewer}
      session={detail.session}
      replies={detail.replies}
      privateNote={viewer === "sender" ? detail.privateNote : null}
      partnerName={partner?.name ?? "Dia"}
      sentLabel={formatInstant(detail.session.created_at, ctx.profile.timezone)}
    />
  );
}

function Gone() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-hand text-2xl text-accent-ink">hmm…</p>
      <h1 className="font-display text-2xl font-medium text-ink">Ruang ini sudah nggak ada.</h1>
      <p className="max-w-sm text-ink-soft">
        Mungkin sudah dilepaskan, atau memang bukan untukmu. Nggak apa-apa.
      </p>
      <Link href="/hold" className="mt-3 text-sm text-accent-ink hover:underline">
        ← kembali ke Hold
      </Link>
    </div>
  );
}
