import { getSpaceContext } from "@/lib/auth";
import { Bloom } from "./bloom";

// A little surprise: a few words, then flowers bloom. Full-screen, deliberately
// not in the nav — reached only by opening /bloom directly.
export default async function BloomPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null; // layout handles the pre-setup / signed-out state

  return <Bloom />;
}
