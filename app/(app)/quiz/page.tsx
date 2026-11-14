import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { winnerOf } from "@/lib/quiz/logic";
import { StartGame } from "./start-game";

export const metadata: Metadata = { title: "Seberapa Kenal Kita?" };

export default async function QuizHome() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const admin = createAdminClient();
  const { data: games } = await admin
    .from("quiz_games")
    .select("id, status, round, created_at, completed_at")
    .eq("space_id", ctx.spaceId)
    .in("status", ["preparing", "playing", "completed"])
    .order("created_at", { ascending: false })
    .limit(30);
  const live = games?.find((g) => g.status !== "completed");
  const done = games?.filter((g) => g.status === "completed") ?? [];
  // Correct counts only (never answers) — safe to read once a game is complete.
  const { data: picks } = done.length
    ? await admin.from("quiz_picks").select("game_id, guesser_id").eq("correct", true).in("game_id", done.map((g) => g.id))
    : { data: [] };
  const right = (game: string, who: string) => picks?.filter((p) => p.game_id === game && p.guesser_id === who).length ?? 0;
  const name = partner?.name ?? "Dia";

  return (
    <div className="space-y-5">
      <PaperCard>
        <Eyebrow>seberapa kenal kita? ❤️</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">Katanya saling mengenal, sekarang buktikan.</h1>
        <p className="mt-2 text-sm text-ink-soft">
          25 pertanyaan tentang dirimu sendiri, lalu kalian saling menebak — bersamaan, tanpa timer. Bisa dimainkan
          dari jauh.
        </p>
      </PaperCard>

      {live ? (
        <Link href={`/quiz/${live.id}`} className="group block">
          <PaperCard lift className="transition group-hover:-translate-y-0.5">
            <Eyebrow>{live.status === "preparing" ? "sedang persiapan" : `ronde ${live.round + 1} / 25`}</Eyebrow>
            <p className="mt-2 font-display text-xl text-ink">Permainan sedang berjalan</p>
            <p className="mt-1 text-sm text-accent-ink">Lanjutkan →</p>
          </PaperCard>
        </Link>
      ) : partner ? (
        <PaperCard>
          <StartGame />
        </PaperCard>
      ) : null}

      {done.length > 0 && (
        <PaperCard>
          <Eyebrow>riwayat</Eyebrow>
          <ul className="mt-3 divide-y divide-rule">
            {done.map((g) => {
              const me = right(g.id, ctx.userId);
              const them = partner ? right(g.id, partner.id) : 0;
              const w = winnerOf(me, them);
              return (
                <li key={g.id}>
                  <Link href={`/quiz/${g.id}`} className="flex items-center justify-between py-3 text-sm hover:text-accent-ink">
                    <span className="text-ink">
                      {format(new Date(g.completed_at ?? g.created_at), "d MMM yyyy", { locale: localeId })}
                    </span>
                    <span className="text-ink-soft">
                      Kamu {me * 4}% · {name} {them * 4}% · {w === "tie" ? "seri 🤝" : w === "me" ? "kamu 🏆" : `${name} 🏆`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </PaperCard>
      )}
    </div>
  );
}
