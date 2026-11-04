import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { aiConfigured } from "@/lib/words/ai";
import { getDelivery, getSealedOne } from "@/lib/words/queries";
import { openWhenLabel } from "@/lib/words/options";
import { PaperCard } from "@/components/ui/paper-card";
import { BackLink } from "@/components/words/back-link";
import { Reading } from "./reading";

export const metadata: Metadata = { title: "To You · little words." };

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const [detail, partner] = await Promise.all([getDelivery(id, ctx.userId), getPartner(ctx.spaceId, ctx.userId)]);

  if (!detail) {
    // Locked for me: say only that it waits, and until when.
    const sealed = await getSealedOne(ctx.spaceId, id);
    if (!sealed) notFound();
    const at = format(new TZDate(new Date(sealed.unlock_at).getTime(), ctx.profile.timezone), "EEEE, d MMMM yyyy · HH:mm", {
      locale: localeId,
    });
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/words/to-you" label="To You" />
        <PaperCard lift className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <p className="text-5xl" aria-hidden>
            🔒
          </p>
          <p className="font-display text-2xl italic text-ink text-balance">
            {openWhenLabel(sealed.open_when, sealed.open_when_label) ?? `Something from ${partner?.name ?? "Dia"}`}
          </p>
          <p className="text-ink-soft">Belum waktunya. Amplop ini akan terbuka</p>
          <p className="font-mono text-sm text-accent-ink">{at}</p>
          <p className="mt-2 max-w-xs text-sm text-ink-faint">Sampai saat itu, isinya tersimpan rapat — bahkan dari sini. ♡</p>
        </PaperCard>
        <Link href="/words/to-you" className="text-center text-sm text-ink-soft underline underline-offset-4">
          Kembali
        </Link>
      </div>
    );
  }

  const d = detail.delivery;
  const iAmRecipient = d.recipient_id === ctx.userId;
  return (
    <Reading
      key={d.id}
      detail={detail}
      iAmRecipient={iAmRecipient}
      partnerName={partner?.name ?? "Dia"}
      selfName={ctx.profile.nickname || ctx.profile.display_name}
      aiReady={aiConfigured()}
      timezone={ctx.profile.timezone}
    />
  );
}
