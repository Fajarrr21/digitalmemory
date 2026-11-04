import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localDateISO } from "@/lib/date";
import { aiConfigured } from "@/lib/words/ai";
import { getDelivery, getWork } from "@/lib/words/queries";
import { nextBirthdayISO } from "@/lib/words/logic";
import { WorkEditor } from "./work-editor";

export const metadata: Metadata = { title: "little words." };

export default async function WorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reply?: string }>;
}) {
  const { id } = await params;
  const { reply } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const [detail, partner] = await Promise.all([getWork(id, ctx.userId), getPartner(ctx.spaceId, ctx.userId)]);
  if (!detail) notFound();

  const today = localDateISO(ctx.profile.timezone);
  let partnerBirthday: string | null = null;
  if (partner) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("birthday").eq("id", partner.id).maybeSingle();
    partnerBirthday = nextBirthdayISO(data?.birthday, today);
  }

  // Replying to something that was given to me?
  let replyTo: { id: string; title: string } | null = null;
  if (reply && /^[0-9a-f-]{36}$/i.test(reply)) {
    const r = await getDelivery(reply, ctx.userId);
    if (r && r.delivery.recipient_id === ctx.userId) replyTo = { id: r.delivery.id, title: r.delivery.title };
  }

  return (
    <WorkEditor
      replyTo={replyTo}
      key={detail.work.id}
      detail={detail}
      aiReady={aiConfigured()}
      partnerName={partner?.name ?? null}
      partnerBirthday={partnerBirthday}
      today={today}
      authorName={ctx.profile.nickname || ctx.profile.display_name}
    />
  );
}
