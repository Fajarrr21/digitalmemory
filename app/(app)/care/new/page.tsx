import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getCareOverview } from "@/lib/care/queries";
import { CareComposer } from "./care-composer";

export const metadata: Metadata = { title: "How Are You Feeling?" };

export default async function NewCarePage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const [overview, partner] = await Promise.all([
    getCareOverview(ctx.spaceId, ctx.userId),
    getPartner(ctx.spaceId, ctx.userId),
  ]);
  if (!overview.ready) redirect("/care");
  // One open Little Care at a time — the open one is where to go.
  if (overview.mine) redirect(`/care/${overview.mine.id}`);

  return <CareComposer partnerName={partner?.name ?? "Dia"} hasPartner={!!partner} />;
}
