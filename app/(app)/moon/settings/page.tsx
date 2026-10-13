import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getMoonData } from "@/lib/moon/queries";
import { ShareSettings } from "./share-settings";
import { RemindersManager } from "./reminders-manager";

export const metadata: Metadata = { title: "her little moon · settings" };

export default async function MoonSettingsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  if (ctx.role !== "keeper") redirect("/moon");
  const [data, partner] = await Promise.all([getMoonData(ctx.userId, ctx.profile.timezone), getPartner(ctx.spaceId, ctx.userId)]);
  if (!data.ready) redirect("/moon");
  return (
    <div className="flex flex-col gap-6">
      <ShareSettings initial={data.share} partnerName={partner?.name ?? "Dia"} />
      <RemindersManager reminders={data.reminders} hasWhatsApp={!!ctx.profile.whatsapp} />
    </div>
  );
}
