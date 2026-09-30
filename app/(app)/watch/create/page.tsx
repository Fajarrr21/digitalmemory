import type { Metadata } from "next";
import { getSpaceContext } from "@/lib/auth";
import { CreateWatch } from "./create-watch";

export const metadata: Metadata = { title: "Watch Together" };

export default async function CreateWatchPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  return <CreateWatch />;
}
