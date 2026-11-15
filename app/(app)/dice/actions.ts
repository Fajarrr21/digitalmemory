"use server";

import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { categoryByFace, categoryOf, MODES, type DiceMode } from "@/lib/dice/config";
import { dealCards, drawWild, faceFrom, poolFor, type DiceCurrent } from "@/lib/dice/logic";
import { drawPrize, stepOn, type BoardMove } from "@/lib/dice/board";
import type { Database, DiceStatus } from "@/lib/supabase/database.types";

/**
 * Roll the Love Dice — every move goes through here on the admin client:
 * signed in, same space, my turn, and `version` must still match what I saw,
 * so a double tap (or both of us tapping) can never apply a move twice.
 */

export type DiceTurn = {
  id: string;
  playerId: string;
  category: string;
  wild: string | null;
  texts: string[];
  answer: string | null;
  partnerAnswer: string | null;
  status: "done" | "skipped";
  at: string;
  saved: boolean;
};

export type DiceView = {
  id: string;
  mode: DiceMode;
  status: DiceStatus;
  version: number;
  selfId: string;
  partnerId: string;
  partnerName: string;
  turnUser: string | null;
  current: DiceCurrent | null;
  doneCount: number;
  skipCount: number;
  me: { joined: boolean; ready: boolean };
  partner: { joined: boolean; ready: boolean; online: boolean };
  recent: DiceTurn[];
  /** category key → done count, for the end-of-game card */
  byCategory: Record<string, number>;
  /** Ular Tangga */
  kind: "free" | "board";
  positions: Record<string, number>;
  lastMove: BoardMove | null;
  winner: string | null;
  prize: string | null;
  prizeDone: boolean;
};

export type DiceResult = { ok?: boolean; error?: string; view?: DiceView; id?: string };

const SESSION_GONE = "Sesi kamu habis. Masuk lagi ya.";
const NOT_FOUND = "Permainan ini tidak ditemukan.";
const ONLINE_MS = 12_000;
const Uuid = z.string().uuid();
const Answer = z.string().trim().max(2000);

/** Uniform [0,1) from the OS CSPRNG, so every face really is 1 in 6. */
const fair = () => randomInt(0, 2 ** 32) / 2 ** 32;

async function load(gameId: string) {
  if (!Uuid.safeParse(gameId).success) return null;
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const admin = createAdminClient();
  const [{ data: game }, partner] = await Promise.all([
    admin.from("dice_games").select("*").eq("id", gameId).maybeSingle(),
    getPartner(ctx.spaceId, ctx.userId),
  ]);
  if (!game || game.space_id !== ctx.spaceId || !partner) return null;
  return { ctx, admin, game, partner };
}
type Loaded = NonNullable<Awaited<ReturnType<typeof load>>>;
type GamePatch = Database["public"]["Tables"]["dice_games"]["Update"];

/** Apply a move only if nobody moved since `version`. Returns false when beaten to it. */
async function move(l: Loaded, patch: GamePatch) {
  const { data } = await l.admin
    .from("dice_games")
    .update({ ...patch, version: l.game.version + 1 })
    .eq("id", l.game.id)
    .eq("version", l.game.version)
    .select("id");
  return !!data?.length;
}

export async function getDiceState(gameId: string): Promise<DiceResult> {
  const l = await load(gameId);
  return l ? stateOf(l) : { error: NOT_FOUND };
}

/** After a move: re-read just the game row (auth + partner are already known). */
async function fresh(l: Loaded): Promise<DiceResult> {
  const { data: game } = await l.admin.from("dice_games").select("*").eq("id", l.game.id).single();
  return stateOf(game ? { ...l, game } : l);
}

async function stateOf(l: Loaded): Promise<DiceResult> {
  const { ctx, admin, game, partner } = l;

  // One parallel round: heartbeat ("joined" + the partner's online dot) and reads.
  const [, { data: players }, { data: turns }, { data: cats }, { data: saved }] = await Promise.all([
    game.status !== "ended"
      ? admin
          .from("dice_players")
          .upsert({ game_id: game.id, user_id: ctx.userId, seen_at: new Date().toISOString() }, { onConflict: "game_id,user_id" })
      : null,
    admin.from("dice_players").select("*").eq("game_id", game.id),
    admin.from("dice_turns").select("*").eq("game_id", game.id).order("created_at", { ascending: false }).limit(6),
    game.status === "ended"
      ? admin.from("dice_turns").select("category").eq("game_id", game.id).eq("status", "done")
      : Promise.resolve({ data: [] as { category: string }[] }),
    admin.from("dice_memories").select("turn_id").eq("game_id", game.id),
  ]);
  const savedIds = new Set(saved?.map((s) => s.turn_id));
  // the heartbeat ran alongside the read, so count myself as joined regardless
  const mine = players?.find((p) => p.user_id === ctx.userId) ?? { ready_at: null };
  const theirs = players?.find((p) => p.user_id === partner.id);
  const byCategory: Record<string, number> = {};
  for (const c of cats ?? []) byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;

  // A secret custom card stays secret from its author's partner until it's dealt —
  // and once dealt it's simply on the table for both, which is the point.
  return {
    ok: true,
    view: {
      id: game.id,
      mode: game.mode,
      status: game.status,
      version: game.version,
      selfId: ctx.userId,
      partnerId: partner.id,
      partnerName: partner.name,
      turnUser: game.turn_user,
      current: game.current,
      doneCount: game.done_count,
      skipCount: game.skip_count,
      me: { joined: true, ready: !!mine.ready_at },
      partner: {
        joined: !!theirs,
        ready: !!theirs?.ready_at,
        online: !!theirs && Date.now() - new Date(theirs.seen_at).getTime() < ONLINE_MS,
      },
      recent: (turns ?? []).map((t) => ({
        id: t.id,
        playerId: t.player_id,
        category: t.category,
        wild: t.wild,
        texts: t.cards.map((c) => c.text),
        answer: t.answer,
        partnerAnswer: t.partner_answer,
        status: t.status,
        at: t.created_at,
        saved: savedIds.has(t.id),
      })),
      byCategory,
      kind: game.kind,
      positions: game.positions,
      lastMove: game.last_move,
      winner: game.winner,
      prize: game.prize,
      prizeDone: game.prize_done,
    },
  };
}

/** Start a game — or land in the live one if there already is one. */
export async function createDiceGame(mode: DiceMode, kind: "free" | "board" = "free"): Promise<DiceResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!MODES.some((m) => m.key === mode) || !["free", "board"].includes(kind)) return { error: "Mode-nya tidak dikenal." };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dice_games")
    .insert({ space_id: ctx.spaceId, created_by: ctx.userId, mode, kind })
    .select("id")
    .single();
  if (data) return { ok: true, id: data.id };
  if (error?.code === "23505") {
    const { data: live } = await admin
      .from("dice_games")
      .select("id")
      .eq("space_id", ctx.spaceId)
      .in("status", ["lobby", "playing"])
      .maybeSingle();
    if (live) return { ok: true, id: live.id };
  }
  return { error: "Gagal memulai permainan. Coba lagi ya." };
}

/** Ready / not ready in the lobby. The second "ready" starts the game with a random first player. */
export async function setReady(gameId: string, ready: boolean): Promise<DiceResult> {
  const l = await load(gameId);
  if (!l) return { error: NOT_FOUND };
  if (l.game.status !== "lobby") return stateOf(l);
  const now = new Date().toISOString();
  await l.admin
    .from("dice_players")
    .upsert({ game_id: gameId, user_id: l.ctx.userId, ready_at: ready ? now : null, seen_at: now }, { onConflict: "game_id,user_id" });

  if (ready) {
    const { count } = await l.admin
      .from("dice_players")
      .select("user_id", { count: "exact", head: true })
      .eq("game_id", gameId)
      .not("ready_at", "is", null);
    if ((count ?? 0) >= 2) {
      const first = randomInt(0, 2) === 0 ? l.ctx.userId : l.partner.id;
      await move(l, { status: "playing", started_at: now, turn_user: first });
    }
  }
  return fresh(l);
}

async function myTurn(gameId: string) {
  const l = await load(gameId);
  if (!l) return { error: NOT_FOUND } as const;
  if (l.game.status !== "playing") return { error: "Permainan belum / sudah tidak berjalan." } as const;
  if (l.game.turn_user !== l.ctx.userId) return { error: "Bukan giliranmu dulu ♡" } as const;
  return { l } as const;
}

async function deal(l: Loaded, face: number, n: number, category?: string) {
  const cat = category ? categoryOf(category) : categoryByFace(face);
  const { data: customs } = await l.admin
    .from("dice_custom")
    .select("id, author_id, category, modes, kind, text, secret")
    .eq("space_id", l.ctx.spaceId)
    .eq("category", cat.key);
  return { cat, cards: dealCards(poolFor(cat.key, l.ctx.userId, customs ?? []), l.game.mode, l.game.seen, fair, n) };
}

export async function rollDice(gameId: string): Promise<DiceResult> {
  const t = await myTurn(gameId);
  if ("error" in t) return { error: t.error };
  const { l } = t;
  if (l.game.current) return stateOf(l);
  if (l.game.kind === "board") return rollOnBoard(l);

  const wild = drawWild(fair);
  const base = { id: randomUUID(), wild, partnerAnswer: null, rolledAt: new Date().toISOString() };
  let current: DiceCurrent;
  if (wild === "choice") {
    current = { ...base, face: null, category: null, cards: [] };
  } else {
    const face = faceFrom(fair);
    const { cat, cards } = await deal(l, face, wild === "double" ? 2 : 1);
    current = { ...base, face, category: cat.key, cards };
  }
  await move(l, { current, seen: [...l.game.seen, ...current.cards.map((c) => c.key)] });
  return fresh(l);
}

/**
 * Ular Tangga: move my pawn. A ladder climbs at once (+ a sweet-words card), a
 * snake deals a card first and slides me down when it's closed, a ♥ deals a
 * card, a plain square just passes the turn, 30 wins and draws the prize.
 */
async function rollOnBoard(l: Loaded): Promise<DiceResult> {
  const me = l.ctx.userId;
  const face = faceFrom(fair);
  const from = l.game.positions[me] ?? 0;
  const step = stepOn(from, face);
  const lastMove: BoardMove = { id: randomUUID(), by: me, face, from, ...step };
  const positions = { ...l.game.positions, [me]: step.event === "snake" ? step.landed : step.to };

  if (step.event === "finish") {
    await move(l, {
      positions,
      last_move: lastMove,
      status: "ended",
      ended_at: new Date().toISOString(),
      winner: me,
      prize: drawPrize(fair),
    });
    revalidatePath("/dice");
    return fresh(l);
  }
  if (step.event === "plain") {
    await move(l, { positions, last_move: lastMove, turn_user: l.partner.id });
    return fresh(l);
  }
  const { cat, cards } = await deal(l, face, 1, step.event === "ladder" ? "sweet" : undefined);
  const current: DiceCurrent = {
    id: lastMove.id,
    face,
    category: cat.key,
    wild: null,
    cards,
    partnerAnswer: null,
    rolledAt: new Date().toISOString(),
    board: { event: step.event, landed: step.landed, to: step.to },
  };
  await move(l, { positions, last_move: lastMove, current, seen: [...l.game.seen, ...cards.map((c) => c.key)] });
  return fresh(l);
}

/** The prize after Ular Tangga: either of us may swap it, the one who does it marks it done. */
export async function prizeAction(gameId: string, kind: "swap" | "done"): Promise<DiceResult> {
  const l = await load(gameId);
  if (!l) return { error: NOT_FOUND };
  const g = l.game;
  if (g.kind !== "board" || !g.winner || !g.prize || g.prize_done) return stateOf(l);
  if (kind === "done" && g.winner === l.ctx.userId) return { error: "Yang mengerjakan hadiahnya yang menandai selesai ♡" };
  await move(l, kind === "swap" ? { prize: drawPrize(fair, g.prize) } : { prize_done: true });
  return fresh(l);
}

/** Your Choice: I pick the face myself. */
export async function chooseCategory(gameId: string, face: number): Promise<DiceResult> {
  if (!Number.isInteger(face) || face < 1 || face > 6) return { error: "Kategorinya tidak valid." };
  const t = await myTurn(gameId);
  if ("error" in t) return { error: t.error };
  const { l } = t;
  const cur = l.game.current;
  if (!cur || cur.wild !== "choice" || cur.cards.length) return stateOf(l);
  const { cat, cards } = await deal(l, face, 1);
  await move(l, { current: { ...cur, face, category: cat.key, cards }, seen: [...l.game.seen, ...cards.map((c) => c.key)] });
  return fresh(l);
}

/** Switch Roles: the one whose turn it ISN'T answers the same question too. */
export async function answerAlongside(gameId: string, text: string): Promise<DiceResult> {
  const parsed = Answer.safeParse(text);
  if (!parsed.success) return { error: "Jawabannya kepanjangan." };
  for (let attempt = 0; attempt < 3; attempt++) {
    const l = await load(gameId);
    if (!l) return { error: NOT_FOUND };
    const cur = l.game.current;
    if (l.game.status !== "playing" || l.game.turn_user === l.ctx.userId || cur?.wild !== "switch") {
      return stateOf(l);
    }
    if (await move(l, { current: { ...cur, partnerAnswer: parsed.data || null } })) break;
  }
  return getDiceState(gameId);
}

/**
 * Close the open card. done / skip pass the turn; "heart" (only on a Heart
 * Skip card) clears it and lets me roll again. `save` keeps it in Our Dice
 * Memories straight away.
 */
export async function finishTurn(
  gameId: string,
  outcome: "done" | "skip" | "heart",
  answer: string,
  save: boolean,
): Promise<DiceResult> {
  const parsed = Answer.safeParse(answer);
  if (!parsed.success) return { error: "Jawabannya kepanjangan." };
  // Retry when only the partner's Switch Roles answer moved the version under us.
  let l: Loaded | null = null;
  let cur: DiceCurrent | null = null;
  for (let attempt = 0; attempt < 3 && !l; attempt++) {
    const t = await myTurn(gameId);
    if ("error" in t) return { error: t.error };
    const c = t.l.game.current;
    if (!c || !c.cards.length || !c.category) return stateOf(t.l);
    if (outcome === "heart" && c.wild !== "heart") return { error: "Ini bukan kartu Heart Skip." };
    const done = outcome === "done";
    const claimed = await move(t.l, {
      current: null,
      turn_user: outcome === "heart" ? t.l.ctx.userId : t.l.partner.id,
      // a snake slides me down once its card is closed, done or skipped
      ...(c.board?.event === "snake" && { positions: { ...t.l.game.positions, [t.l.ctx.userId]: c.board.to } }),
      done_count: t.l.game.done_count + (done ? 1 : 0),
      skip_count: t.l.game.skip_count + (done ? 0 : 1),
    });
    if (claimed) [l, cur] = [t.l, c];
  }
  if (!l || !cur?.category) return getDiceState(gameId);
  const done = outcome === "done";

  const { data: turn } = await l.admin
    .from("dice_turns")
    .insert({
      game_id: gameId,
      space_id: l.ctx.spaceId,
      player_id: l.ctx.userId,
      face: cur.face,
      category: cur.category,
      wild: cur.wild,
      cards: cur.cards,
      answer: done ? parsed.data || null : null,
      partner_answer: cur.partnerAnswer ?? null,
      status: done ? "done" : "skipped",
    })
    .select("id")
    .single();
  if (done && save && turn) await saveTurn(turn.id);
  return fresh(l);
}

/** Keep a finished turn in Our Dice Memories (either of us; once per turn). */
export async function saveTurn(turnId: string): Promise<DiceResult> {
  if (!Uuid.safeParse(turnId).success) return { error: NOT_FOUND };
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const admin = createAdminClient();
  const { data: t } = await admin.from("dice_turns").select("*").eq("id", turnId).maybeSingle();
  if (!t || t.space_id !== ctx.spaceId || t.status !== "done") return { error: "Momen ini tidak bisa disimpan." };
  const { error } = await admin.from("dice_memories").upsert(
    {
      space_id: t.space_id,
      turn_id: t.id,
      game_id: t.game_id,
      saved_by: ctx.userId,
      player_id: t.player_id,
      category: t.category,
      challenge: t.cards.map((c) => c.text).join("\n\n"),
      answer: t.answer,
      partner_answer: t.partner_answer,
      played_at: t.created_at,
    },
    { onConflict: "turn_id", ignoreDuplicates: true },
  );
  if (error) return { error: "Gagal menyimpan momen. Coba lagi ya." };
  revalidatePath("/dice/memories");
  return { ok: true };
}

/** Either of us can end it, any time. */
export async function endDiceGame(gameId: string): Promise<DiceResult> {
  const l = await load(gameId);
  if (!l) return { error: NOT_FOUND };
  await l.admin
    .from("dice_games")
    .update({ status: "ended", ended_at: new Date().toISOString(), current: null, version: l.game.version + 1 })
    .eq("id", gameId)
    .in("status", ["lobby", "playing"]);
  revalidatePath("/dice");
  return fresh(l);
}
