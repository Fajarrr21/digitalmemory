import type { Metadata } from "next";
import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { CustomManager } from "./custom-manager";

export const metadata: Metadata = { title: "Tantangan Pribadi" };

export default async function DiceCustomPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const supabase = await createClient();
  // RLS: all of mine + only my partner's non-secret ones
  const { data } = await supabase
    .from("dice_custom")
    .select("id, author_id, category, modes, kind, text, secret")
    .eq("space_id", ctx.spaceId)
    .order("created_at", { ascending: false });
  const all = data ?? [];
  const name = partner?.name ?? "Dia";

  return (
    <div className="space-y-5">
      <Link href="/dice" className="text-sm text-ink-soft hover:text-accent-ink">
        ← Roll the Love Dice
      </Link>
      <PaperCard>
        <Eyebrow>✍️ tantangan pribadi</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">Tulis sendiri, untuk {name}.</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Tantangan yang kamu tulis ikut masuk ke dadu — dan hanya muncul di giliran {name}. Tandai 🤫 rahasia kalau
          kamu mau {name} baru tahu saat dadunya jatuh ke sana.
        </p>
      </PaperCard>
      <CustomManager mine={all.filter((c) => c.author_id === ctx.userId)} theirs={all.filter((c) => c.author_id !== ctx.userId)} partnerName={name} />
    </div>
  );
}
