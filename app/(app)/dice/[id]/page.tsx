import type { Metadata } from "next";
import Link from "next/link";
import { getSpaceContext } from "@/lib/auth";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import { PaperCard } from "@/components/ui/paper-card";
import { getDiceState } from "../actions";
import { DiceGame } from "../dice-game";

export const metadata: Metadata = { title: "Roll the Love Dice" };

export default async function DiceGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, ctx] = await Promise.all([getDiceState(id), getSpaceContext()]);
  if (!res.view || !ctx) {
    return (
      <PaperCard className="text-center">
        <p className="font-display text-xl text-ink">Permainan ini tidak ditemukan.</p>
        <Link href="/dice" className="mt-3 inline-block text-sm text-accent-ink hover:underline">
          ← Kembali
        </Link>
      </PaperCard>
    );
  }
  // Avatars are signed once here, not on every poll.
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("avatar_path").eq("id", res.view.partnerId).maybeSingle();
  const signed = await signPaths([ctx.profile.avatar_path, p?.avatar_path].filter((x): x is string => !!x), 6 * 3600);
  return (
    <DiceGame
      initial={res.view}
      faces={{
        me: { name: ctx.profile.nickname || ctx.profile.display_name, avatar: signed[ctx.profile.avatar_path ?? ""] ?? null },
        partner: { avatar: signed[p?.avatar_path ?? ""] ?? null },
      }}
    />
  );
}
