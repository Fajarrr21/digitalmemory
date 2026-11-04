import type { Metadata } from "next";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getToYou } from "@/lib/words/queries";
import { NotReady } from "../not-ready";
import { ToYouInbox } from "./to-you-inbox";

export const metadata: Metadata = { title: "To You · little words." };

export default async function ToYouPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const [data, partner] = await Promise.all([getToYou(ctx.spaceId, ctx.userId), getPartner(ctx.spaceId, ctx.userId)]);
  if (!data.ready) return <NotReady />;
  return <ToYouInbox data={data} partnerName={partner?.name ?? "Dia"} timezone={ctx.profile.timezone} />;
}
