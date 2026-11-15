import type { Metadata } from "next";
import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { MemoryBook } from "./memory-book";

export const metadata: Metadata = { title: "Our Dice Memories" };

export default async function DiceMemoriesPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("dice_memories")
    .select("*")
    .eq("space_id", ctx.spaceId)
    .order("played_at", { ascending: false })
    .limit(300);

  return (
    <div className="space-y-5">
      <Link href="/dice" className="text-sm text-ink-soft hover:text-accent-ink">
        ← Roll the Love Dice
      </Link>
      <PaperCard>
        <Eyebrow>📖 our dice memories</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">Hal-hal kecil yang kita temukan.</h1>
        <p className="mt-2 font-hand text-xl text-ink-soft">dari satu lemparan dadu ke lemparan berikutnya ♡</p>
      </PaperCard>
      <MemoryBook
        memories={data ?? []}
        names={{ [ctx.userId]: ctx.profile.nickname || ctx.profile.display_name, ...(partner && { [partner.id]: partner.name }) }}
      />
    </div>
  );
}
