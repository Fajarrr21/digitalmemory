import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { CATEGORIES, DICE_TAGLINE, MODES } from "@/lib/dice/config";
import { StartGame } from "./start-game";

export const metadata: Metadata = { title: "Roll the Love Dice" };

export default async function DiceHome() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const admin = createAdminClient();
  const [{ data: live }, { count: games }, { data: turns }, { count: memories }, { data: past }] = await Promise.all([
    admin.from("dice_games").select("id, status, mode, kind").eq("space_id", ctx.spaceId).in("status", ["lobby", "playing"]).maybeSingle(),
    admin.from("dice_games").select("id", { count: "exact", head: true }).eq("space_id", ctx.spaceId).neq("status", "lobby"),
    admin.from("dice_turns").select("category, player_id").eq("space_id", ctx.spaceId).eq("status", "done"),
    admin.from("dice_memories").select("id", { count: "exact", head: true }).eq("space_id", ctx.spaceId),
    admin
      .from("dice_games")
      .select("id, kind, mode, winner, prize, prize_done, done_count, skip_count, created_at, ended_at")
      .eq("space_id", ctx.spaceId)
      .eq("status", "ended")
      .order("ended_at", { ascending: false })
      .limit(50),
  ]);
  // a game cancelled from the lobby (nothing played) isn't worth a line
  const history = (past ?? []).filter((g) => g.winner || g.done_count + g.skip_count > 0);
  const wins = (who: string) => history.filter((g) => g.winner === who).length;
  const done = turns ?? [];
  const byCat = CATEGORIES.map((c) => ({ c, n: done.filter((t) => t.category === c.key).length }));
  const maxN = Math.max(1, ...byCat.map((x) => x.n));
  const mineDone = done.filter((t) => t.player_id === ctx.userId).length;
  const name = partner?.name ?? "dia";

  return (
    <div className="space-y-5">
      <PaperCard className="relative overflow-hidden">
        <Eyebrow>🎲 roll the love dice</Eyebrow>
        <h1 className="mt-3 font-display text-3xl text-ink">Satu dadu, dua orang, banyak hal kecil.</h1>
        <p className="mt-2 font-hand text-xl text-ink-soft">{DICE_TAGLINE}</p>
        <p className="mt-3 text-sm text-ink-soft">
          Gantian melempar dadu. Main <b className="font-medium text-ink">Ular Tangga</b> — kena ular, naik tangga,
          atau mampir di kotak ♥ berarti ada tantangan — atau <b className="font-medium text-ink">Lempar Bebas</b>, satu
          tantangan tiap lemparan. Jawab, lakukan, atau lewati. Cuma kita, sedikit lebih kenal.
        </p>
        <span aria-hidden className="pointer-events-none absolute -right-3 -bottom-4 text-8xl opacity-10">
          🎲
        </span>
      </PaperCard>

      {live ? (
        <Link href={`/dice/${live.id}`} className="group block">
          <PaperCard lift className="bg-gradient-to-br from-blush/40 to-paper transition group-hover:-translate-y-0.5">
            <Eyebrow>
              {live.kind === "board" ? "🐍🪜 ular tangga" : "🎲 lempar bebas"} ·{" "}
              {live.status === "lobby" ? "menunggu di lobby" : "sedang bermain"} ·{" "}
              {MODES.find((m) => m.key === live.mode)?.label} mode
            </Eyebrow>
            <p className="mt-2 font-display text-xl text-ink">Mejanya masih terbuka ♡</p>
            <p className="mt-1 text-sm text-accent-ink">Lanjutkan →</p>
          </PaperCard>
        </Link>
      ) : partner ? (
        <PaperCard>
          <Eyebrow>mulai</Eyebrow>
          <div className="mt-3">
            <StartGame />
          </div>
        </PaperCard>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/dice/memories" className="group block">
          <PaperCard className="h-full transition group-hover:-translate-y-0.5">
            <Eyebrow>📖 our dice memories</Eyebrow>
            <p className="mt-2 font-display text-lg text-ink">
              {memories ? `${memories} momen tersimpan` : "Belum ada yang disimpan"}
            </p>
            <p className="mt-1 text-sm text-ink-soft">Buka jurnalnya →</p>
          </PaperCard>
        </Link>
        <Link href="/dice/custom" className="group block">
          <PaperCard className="h-full transition group-hover:-translate-y-0.5">
            <Eyebrow>✍️ tantangan pribadi</Eyebrow>
            <p className="mt-2 font-display text-lg text-ink">Tulis tantanganmu sendiri</p>
            <p className="mt-1 text-sm text-ink-soft">Untuk {name}, boleh rahasia →</p>
          </PaperCard>
        </Link>
      </div>

      {history.length > 0 && (
        <PaperCard>
          <Eyebrow>riwayat permainan</Eyebrow>
          {history.some((g) => g.winner) && (
            <p className="mt-2 text-sm text-ink-soft">
              🐍🪜 menang ular tangga: kamu <span className="font-mono text-ink">{wins(ctx.userId)}</span> · {name}{" "}
              <span className="font-mono text-ink">{partner ? wins(partner.id) : 0}</span>
            </p>
          )}
          <ul className="mt-3 divide-y divide-rule">
            {history.map((g) => (
              <li key={g.id}>
                <Link href={`/dice/${g.id}`} className="flex items-start justify-between gap-3 py-3 hover:text-accent-ink">
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">
                      {g.kind === "board" ? "🐍🪜 Ular Tangga" : "🎲 Lempar Bebas"}
                      <span className="text-ink-faint"> · {MODES.find((m) => m.key === g.mode)?.label}</span>
                    </span>
                    <span className="block font-mono text-[11px] text-ink-faint">
                      {format(new Date(g.ended_at ?? g.created_at), "d MMM yyyy · HH:mm", { locale: localeId })} ·{" "}
                      {g.done_count} tantangan
                    </span>
                    {g.prize && (
                      <span className="mt-0.5 block truncate font-hand text-lg leading-tight text-ink-soft">
                        hadiah: {g.prize} {g.prize_done ? "✓" : "· belum"}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm">
                    {g.winner ? (g.winner === ctx.userId ? "kamu 🏆" : `${name} 🏆`) : <span className="text-ink-faint">→</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </PaperCard>
      )}

      {done.length > 0 && (
        <PaperCard>
          <Eyebrow>sejauh ini</Eyebrow>
          <p className="mt-2 text-sm text-ink-soft">
            <span className="font-mono text-ink">{games ?? 0}</span> permainan ·{" "}
            <span className="font-mono text-ink">{done.length}</span> tantangan selesai · kamu{" "}
            <span className="font-mono text-ink">{mineDone}</span>, {name}{" "}
            <span className="font-mono text-ink">{done.length - mineDone}</span>
          </p>
          <ul className="mt-4 space-y-2">
            {byCat.map(({ c, n }) => (
              <li key={c.key} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-ink">
                  {c.icon} {c.name}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-rule-soft">
                  <span className="block h-full rounded-full" style={{ width: `${(n / maxN) * 100}%`, background: c.ink }} />
                </span>
                <span className="w-6 text-right font-mono text-xs text-ink-faint">{n}</span>
              </li>
            ))}
          </ul>
        </PaperCard>
      )}
    </div>
  );
}
