import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCareSession } from "@/lib/care/queries";
import { formatInstant } from "@/lib/date";
import { CareSessionView } from "./care-session";

export const metadata: Metadata = { title: "Little Care" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One Little Care session. The sender sees their own room (plus what they
 * kept private, which RLS never returns to anyone else); the partner sees
 * "Let Me Care for You" with only what was shared. Anyone else — or a
 * deleted session — gets a gentle "gone", because RLS returns no row.
 */
export default async function CareSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const detail = await getCareSession(id);
  if (!detail) return <Gone />;

  const viewer = detail.session.sender_id === ctx.userId ? "sender" : "carer";
  if (viewer === "carer" && !detail.session.opened_at) {
    const supabase = await createClient();
    await supabase.rpc("care_open", { p_session: id });
  }

  const partner = await getPartner(ctx.spaceId, ctx.userId);

  return (
    <CareSessionView
      viewer={viewer}
      session={detail.session}
      actions={detail.actions}
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
      <h1 className="font-display text-2xl font-medium text-ink">Little Care ini sudah nggak ada.</h1>
      <p className="max-w-sm text-ink-soft">Mungkin sudah dilepaskan, atau memang bukan untukmu. Nggak apa-apa.</p>
      <Link href="/care" className="mt-3 text-sm text-accent-ink hover:underline">
        ← kembali ke Little Care
      </Link>
    </div>
  );
}
