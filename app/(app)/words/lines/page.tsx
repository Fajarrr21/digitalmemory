import type { Metadata } from "next";
import { getSpaceContext } from "@/lib/auth";
import { getLines } from "@/lib/words/queries";
import { NotReady } from "../not-ready";
import { Lines } from "./lines";

export const metadata: Metadata = { title: "Lines I Love · little words." };

export default async function LinesPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const { ready, lines } = await getLines(ctx.userId);
  if (!ready) return <NotReady />;
  return <Lines lines={lines} />;
}
