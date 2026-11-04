import type { Metadata } from "next";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { getLibrary } from "@/lib/words/queries";
import { NotReady } from "../not-ready";
import { Library } from "./library";

export const metadata: Metadata = { title: "The Library · little words." };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const { ready, items } = await getLibrary(ctx.userId, partner?.name ?? "Dia");
  if (!ready) return <NotReady />;
  const { c } = await searchParams;
  return <Library items={items} partnerName={partner?.name ?? "Dia"} initialCategory={c ?? null} />;
}
