import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getHoldOverview } from "@/lib/hold/queries";
import { HoldComposer } from "./hold-composer";

export const metadata: Metadata = { title: "What I'm Carrying" };

export default async function NewHoldPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const [overview, partner] = await Promise.all([
    getHoldOverview(ctx.spaceId, ctx.userId),
    getPartner(ctx.spaceId, ctx.userId),
  ]);
  if (!overview.ready) redirect("/hold");
  // One open space at a time — the open one is where to go.
  if (overview.mine) redirect(`/hold/${overview.mine.id}`);

  return <HoldComposer partnerName={partner?.name ?? "Dia"} hasPartner={!!partner} />;
}
