import type { Metadata } from "next";
import { getSpaceContext } from "@/lib/auth";
import { aiConfigured } from "@/lib/words/ai";
import { getDelivery } from "@/lib/words/queries";
import { Muse } from "./muse";

export const metadata: Metadata = { title: "The Muse · little words." };

export default async function MusePage({ searchParams }: { searchParams: Promise<{ reply?: string }> }) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const { reply } = await searchParams;
  let replyTo: { id: string; title: string } | null = null;
  if (reply && /^[0-9a-f-]{36}$/i.test(reply)) {
    const r = await getDelivery(reply, ctx.userId);
    if (r && r.delivery.recipient_id === ctx.userId) replyTo = { id: r.delivery.id, title: r.delivery.title };
  }
  return <Muse aiReady={aiConfigured()} replyTo={replyTo} />;
}
