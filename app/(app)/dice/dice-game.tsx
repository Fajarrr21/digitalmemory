"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { CATEGORIES, DICE_TAGLINE, DONE_LINES, MODES, WILDS, categoryOf } from "@/lib/dice/config";
import type { DiceCurrent } from "@/lib/dice/logic";
import { DiceCube } from "./dice-cube";
import { SnakeBoard, type Pawn } from "./snake-board";
import {
  answerAlongside,
  chooseCategory,
  endDiceGame,
  finishTurn,
  getDiceState,
  rollDice,
  saveTurn,
  prizeAction,
  setReady,
  type DiceResult,
  type DiceView,
} from "./actions";

// Realtime "poke" is the fast path; polling is only the safety net.
const POLL_MS = 3000;

export type Faces = { me: { name: string; avatar: string | null }; partner: { avatar: string | null } };

export function DiceGame({ initial, faces }: { initial: DiceView; faces: Faces }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const channel = useRef<RealtimeChannel | null>(null);
  const apply = useCallback((r: DiceResult) => {
    if (r.view) {
      setView(r.view);
      // tell the other screen to re-read now (the payload carries nothing)
      void channel.current?.send({ type: "broadcast", event: "poke", payload: {} });
    }
    setError(r.error ?? null);
  }, []);
  const refresh = useCallback(async () => {
    const r = await getDiceState(view.id).catch(() => null);
    if (r?.view) setView(r.view);
  }, [view.id]);

  // A public broadcast channel on the game's unguessable id. It only ever
  // carries an empty "something changed" — the state itself is always read
  // through the server actions, so nothing private travels here.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`dice:${view.id}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "poke" }, () => void refresh()).subscribe();
    channel.current = ch;
    return () => {
      channel.current = null;
      void supabase.removeChannel(ch);
    };
  }, [view.id, refresh]);

  const listening = view.status !== "ended" || (view.kind === "board" && !!view.prize && !view.prizeDone);
  // Plain polling, like the quiz: the row is the truth, so a refresh or a lost
  // connection just picks up where the game is.
  useEffect(() => {
    if (!listening) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [listening, refresh]);

  const nameOf = (id: string | null) => (id === view.selfId ? faces.me.name : view.partnerName);

  return (
    <div className="space-y-5">
      <header className="text-center">
        <Eyebrow>🎲 roll the love dice</Eyebrow>
        <p className="mt-1 font-hand text-xl text-ink-soft">{DICE_TAGLINE}</p>
      </header>
      {error && <p className="text-center text-sm text-accent-ink">{error}</p>}
      {view.status === "lobby" && <Lobby view={view} faces={faces} onResult={apply} />}
      {view.status === "playing" && <Board view={view} faces={faces} nameOf={nameOf} onResult={apply} />}
      {view.status === "ended" &&
        (view.kind === "board" && view.winner ? (
          <BoardEnded view={view} faces={faces} nameOf={nameOf} onResult={apply} />
        ) : (
          <Ended view={view} />
        ))}
    </div>
  );
}

/* ---------------------------------------------------------- players -- */

function Avatar({ src, name, size = 48 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
    <img src={src} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="grid place-items-center rounded-full bg-blush font-display text-ink"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Player({
  name,
  avatar,
  active,
  badge,
}: {
  name: string;
  avatar: string | null;
  active: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5 transition", active ? "opacity-100" : "opacity-55")}>
      <span className={cn("rounded-full p-0.5 transition", active ? "ring-2 ring-accent-ink ring-offset-2 ring-offset-ground" : "")}>
        <Avatar src={avatar} name={name} />
      </span>
      <span className="max-w-24 truncate text-sm text-ink">{name}</span>
      {badge}
    </div>
  );
}

/* ------------------------------------------------------------ lobby -- */

function Lobby({ view, faces, onResult }: { view: DiceView; faces: Faces; onResult: (r: DiceResult) => void }) {
  const [pending, start] = useTransition();
  const mode = MODES.find((m) => m.key === view.mode)!;
  const dot = (on: boolean, label: string) => (
    <span className="flex items-center gap-1 font-mono text-[11px] text-ink-faint">
      <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-emerald-500" : "bg-ink-faint/40")} /> {label}
    </span>
  );
  return (
    <PaperCard className="text-center">
      <Eyebrow>
        lobby · {mode.emoji} {mode.label} mode
      </Eyebrow>
      <div className="mt-6 flex items-start justify-center gap-10">
        <Player
          name={faces.me.name}
          avatar={faces.me.avatar}
          active
          badge={view.me.ready ? <span className="text-xs text-accent-ink">siap ♡</span> : dot(true, "online")}
        />
        <span className="mt-3 font-hand text-2xl text-ink-faint">&</span>
        <Player
          name={view.partnerName}
          avatar={faces.partner.avatar}
          active={view.partner.online || view.partner.ready}
          badge={
            view.partner.ready ? (
              <span className="text-xs text-accent-ink">siap ♡</span>
            ) : (
              dot(view.partner.online, view.partner.online ? "online" : view.partner.joined ? "sebentar lagi" : "belum datang")
            )
          }
        />
      </div>
      <p className="mt-6 text-sm text-ink-soft">
        {view.partner.joined
          ? view.me.ready
            ? `Menunggu ${view.partnerName} siap…`
            : "Kalau sudah siap, tap tombolnya ♡"
          : `Ajak ${view.partnerName} buka Roll the Love Dice — permainannya menunggu di sana.`}
      </p>
      <Button
        className="mt-4"
        variant={view.me.ready ? "soft" : "primary"}
        disabled={pending}
        onClick={() => start(async () => onResult(await setReady(view.id, !view.me.ready)))}
      >
        {view.me.ready ? "Belum siap" : "Aku siap ♡"}
      </Button>
      <p className="mt-3 font-mono text-[11px] text-ink-faint">pemain pertama dipilih acak saat kalian berdua siap</p>
      <EndLink id={view.id} onResult={onResult} label="Batalkan" />
    </PaperCard>
  );
}

function EndLink({ id, onResult, label = "Akhiri permainan" }: { id: string; onResult: (r: DiceResult) => void; label?: string }) {
  const [sure, setSure] = useState(false);
  return (
    <button
      type="button"
      className="mt-5 block w-full text-center text-xs text-ink-faint hover:text-accent-ink"
      onClick={async () => {
        if (!sure) return setSure(true);
        onResult(await endDiceGame(id));
      }}
    >
      {sure ? "Yakin? Tap sekali lagi." : label}
    </button>
  );
}

/* ------------------------------------------------------------ board -- */

function Board({
  view,
  faces,
  nameOf,
  onResult,
}: {
  view: DiceView;
  faces: Faces;
  nameOf: (id: string | null) => string;
  onResult: (r: DiceResult) => void;
}) {
  const reduce = useReducedMotion();
  const mine = view.turnUser === view.selfId;
  const cur = view.current;
  const [spinning, setSpinning] = useState(false);
  // the card shows once the die has landed; a reload lands straight on it
  const [revealed, setRevealed] = useState<string | null>(cur?.id ?? null);
  const [toast, setToast] = useState<string | null>(null);
  const [turnBanner, setTurnBanner] = useState<string | null>(null);
  // a fresh game announces who goes first
  const prevTurn = useRef(view.doneCount + view.skipCount === 0 && !cur && !view.lastMove ? null : view.turnUser);
  const board = view.kind === "board";
  const lm = view.lastMove;
  // Ular Tangga: the mover's pawn waits on its old square until the die lands
  const [landed, setLanded] = useState<string | null>(lm?.id ?? null);

  useEffect(() => {
    if (prevTurn.current !== view.turnUser && view.turnUser) {
      const first = prevTurn.current === null;
      const who = view.turnUser === view.selfId ? "kamu" : view.partnerName;
      setTurnBanner(first ? `${who} mulai duluan 🎲` : view.turnUser === view.selfId ? "giliranmu ♡" : `giliran ${view.partnerName}`);
      const t = setTimeout(() => setTurnBanner(null), 1600);
      prevTurn.current = view.turnUser;
      return () => clearTimeout(t);
    }
  }, [view.turnUser, view.selfId, view.partnerName]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const onSettled = useCallback(() => {
    setRevealed(cur?.id ?? null);
    if (!lm) return;
    setLanded(lm.id);
    const who = lm.by === view.selfId ? "kamu" : view.partnerName;
    const line =
      lm.event === "ladder" ? `🪜 naik tangga ke ${lm.to}!`
      : lm.event === "snake" ? `🐍 aduh, ular di ${lm.landed}…`
      : lm.event === "heart" ? `♥ kotak hati!`
      : `${who} maju ke ${lm.to}`;
    setToast(line);
  }, [cur?.id, lm, view.selfId, view.partnerName]);
  const pawns: Pawn[] = [
    { id: view.selfId, name: faces.me.name, avatar: faces.me.avatar, color: "#D99AA8", at: view.positions[view.selfId] ?? 0 },
    { id: view.partnerId, name: view.partnerName, avatar: faces.partner.avatar, color: "#8D6E52", at: view.positions[view.partnerId] ?? 0 },
  ].map((p) => (lm && landed !== lm.id && p.id === lm.by ? { ...p, at: lm.from } : p));
  const choosing = !!cur && cur.wild === "choice" && !cur.cards.length;
  const showCard = !!cur && cur.cards.length > 0 && revealed === cur.id;

  async function roll() {
    setSpinning(true);
    const r = await rollDice(view.id);
    setSpinning(false);
    onResult(r);
  }

  return (
    <div className="space-y-5">
      <PaperCard className="relative overflow-hidden">
        <div className="flex items-start justify-between">
          <Player name={faces.me.name} avatar={faces.me.avatar} active={mine} />
          <div className="pt-2 text-center">
            <p className="font-mono text-[11px] text-ink-faint">
              {MODES.find((m) => m.key === view.mode)?.emoji} {view.mode} · {view.doneCount} selesai
            </p>
            <p className="mt-1 font-display text-lg text-ink">{mine ? "Giliranmu" : `Giliran ${view.partnerName}`}</p>
          </div>
          <Player name={view.partnerName} avatar={faces.partner.avatar} active={!mine} />
        </div>

        {board && (
          <div className="mt-4">
            <SnakeBoard pawns={pawns} activeId={view.turnUser} />
          </div>
        )}
        <DiceCube
          face={board ? (lm?.face ?? null) : (cur?.face ?? null)}
          rollKey={board ? (lm?.id ?? null) : (cur?.id ?? null)}
          spinning={spinning}
          onSettled={onSettled}
        />

        <AnimatePresence>
          {turnBanner && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full bg-paper/95 px-5 py-2 font-hand text-2xl text-accent-ink shadow-[var(--shadow-lift)]"
            >
              {turnBanner}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center">
          {!cur && mine && (
            <Button size="lg" onClick={roll} disabled={spinning} className="min-w-48">
              {spinning ? "Menggelinding…" : "Roll the Dice 🎲"}
            </Button>
          )}
          {!cur && !mine && (
            <p className="font-hand text-xl text-ink-soft">menunggu {view.partnerName} melempar dadu…</p>
          )}
          {choosing && !mine && <p className="font-hand text-xl text-ink-soft">🎯 {view.partnerName} sedang memilih kategori…</p>}
          {cur && cur.cards.length > 0 && !showCard && <p className="font-hand text-xl text-ink-faint">…</p>}
        </div>
        <AnimatePresence>
          {toast && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-center font-hand text-xl text-accent-ink"
            >
              {toast}
            </motion.p>
          )}
        </AnimatePresence>
      </PaperCard>

      {choosing && mine && <ChoosePicker view={view} onResult={onResult} />}

      <AnimatePresence mode="wait">
        {showCard && cur && (
          <ChallengeCard
            key={cur.id}
            view={view}
            cur={cur}
            mine={mine}
            playerName={nameOf(view.turnUser)}
            onResult={onResult}
            onDone={(line) => setToast(line)}
          />
        )}
      </AnimatePresence>

      <Legend />
      <History view={view} nameOf={nameOf} onResult={onResult} />
      <EndLink id={view.id} onResult={onResult} />
    </div>
  );
}

function ChoosePicker({ view, onResult }: { view: DiceView; onResult: (r: DiceResult) => void }) {
  const [pending, start] = useTransition();
  return (
    <PaperCard>
      <Eyebrow>🎯 {WILDS.choice.name}</Eyebrow>
      <p className="mt-2 text-sm text-ink-soft">{WILDS.choice.line}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={pending}
            onClick={() => start(async () => onResult(await chooseCategory(view.id, c.face)))}
            className="rounded-2xl border border-rule px-3 py-3 text-left transition hover:-translate-y-0.5 active:scale-[0.98]"
            style={{ background: `color-mix(in srgb, ${c.tint} 60%, var(--paper))` }}
          >
            <span className="text-lg">{c.icon}</span>
            <span className="mt-1 block text-sm font-medium text-ink">{c.name}</span>
          </button>
        ))}
      </div>
    </PaperCard>
  );
}

/* ------------------------------------------------------------ card -- */

function ChallengeCard({
  view,
  cur,
  mine,
  playerName,
  onResult,
  onDone,
}: {
  view: DiceView;
  cur: DiceCurrent;
  mine: boolean;
  playerName: string;
  onResult: (r: DiceResult) => void;
  onDone: (line: string) => void;
}) {
  const reduce = useReducedMotion();
  const cat = categoryOf(cur.category ?? "sweet");
  const wild = cur.wild ? WILDS[cur.wild] : null;
  const draftKey = `dice:answer:${cur.id}`;
  const [answer, setAnswer] = useState(() => {
    try {
      return localStorage.getItem(draftKey) ?? "";
    } catch {
      return "";
    }
  });
  const [along, setAlong] = useState(cur.partnerAnswer ?? "");
  const [pending, start] = useTransition();
  const writes = cur.cards.some((c) => c.kind === "a");

  useEffect(() => {
    try {
      if (answer) localStorage.setItem(draftKey, answer);
    } catch {}
  }, [answer, draftKey]);

  const finish = (outcome: "done" | "skip" | "heart", save = false) =>
    start(async () => {
      const r = await finishTurn(view.id, outcome, answer, save);
      if (!r.error) {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
        if (outcome === "done") onDone(save ? "disimpan jadi kenangan ♡" : DONE_LINES[Math.floor(Math.random() * DONE_LINES.length)]);
      }
      onResult(r);
    });

  return (
    <motion.section
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, rotate: -1.5, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 160, damping: 18 }}
      className="relative overflow-hidden rounded-[28px] border p-6 shadow-[var(--shadow-lift)]"
      style={{
        background: `linear-gradient(160deg, color-mix(in srgb, ${cat.tint} 75%, var(--paper)), var(--paper))`,
        borderColor: `color-mix(in srgb, ${cat.ink} 30%, transparent)`,
      }}
      aria-live="polite"
    >
      <span aria-hidden className="pointer-events-none absolute -top-4 -right-3 text-8xl opacity-15">
        {cat.icon}
      </span>
      {cur.board && (
        <p className="mb-3 rounded-2xl bg-paper/80 px-3 py-2 text-sm text-ink">
          {cur.board.event === "snake"
            ? `🐍 Kena ular di ${cur.board.landed}! Kerjakan tantangannya — setelah itu turun ke ${cur.board.to}.`
            : cur.board.event === "ladder"
              ? `🪜 Naik tangga ke ${cur.board.to}! Bonus kecil: satu kata manis dulu ♡`
              : `♥ Kotak hati di ${cur.board.landed} — satu tantangan untukmu.`}
        </p>
      )}
      {wild && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-paper/80 px-3 py-1 text-xs text-ink">
          {wild.icon} <b className="font-medium">{wild.name}</b> · {wild.line}
        </p>
      )}
      <p className="font-mono text-[11px] tracking-wide uppercase" style={{ color: cat.ink }}>
        {cur.face ? `0${cur.face} · ` : ""}
        {cat.name}
      </p>
      <div className="mt-3 space-y-4">
        {cur.cards.map((c, i) => (
          <div key={c.key}>
            {cur.cards.length > 1 && <span className="font-mono text-[11px] text-ink-faint">{i + 1}/2</span>}
            <p className="font-display text-2xl leading-snug text-ink">{c.text}</p>
            {c.by && (
              <p className="mt-1 font-hand text-lg text-ink-soft">
                {c.secret ? "🤫 tantangan rahasia" : "✍️ tantangan pribadi"} dari {c.by === view.selfId ? "kamu" : view.partnerName}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 font-hand text-xl text-ink-soft">untuk {mine ? "kamu" : playerName} ♡</p>

      {mine && writes && (
        <label className="mt-4 block">
          <span className="sr-only">Jawabanmu</span>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Tulis jawabanmu di sini (opsional — boleh juga diucapkan langsung)"
            className="w-full rounded-2xl border border-rule bg-paper/80 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
          />
        </label>
      )}
      {!mine && writes && cur.wild !== "switch" && (
        <p className="mt-4 text-sm text-ink-soft">{playerName} sedang menjawab… dengarkan baik-baik ♡</p>
      )}
      {!mine && !writes && <p className="mt-4 text-sm text-ink-soft">{playerName} sedang melakukannya… tonton ya 👀</p>}

      {cur.wild === "switch" &&
        (mine ? (
          <p className="mt-3 rounded-2xl bg-paper/70 px-4 py-3 text-sm text-ink-soft">
            🔁 {view.partnerName}: {cur.partnerAnswer ? <span className="text-ink">{cur.partnerAnswer}</span> : "sedang menulis jawabannya juga…"}
          </p>
        ) : (
          <div className="mt-4">
            <textarea
              value={along}
              onChange={(e) => setAlong(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Jawabanmu juga — pertanyaan yang sama ♡"
              className="w-full rounded-2xl border border-rule bg-paper/80 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
            />
            <Button
              size="sm"
              variant="soft"
              className="mt-2"
              disabled={pending || !along.trim() || along.trim() === (cur.partnerAnswer ?? "")}
              onClick={() => start(async () => onResult(await answerAlongside(view.id, along)))}
            >
              {cur.partnerAnswer ? "Perbarui jawabanku" : "Kirim jawabanku"}
            </Button>
          </div>
        ))}

      {mine && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button disabled={pending} onClick={() => finish("done")}>
            Done ✓
          </Button>
          <Button variant="soft" disabled={pending} onClick={() => finish("done", true)}>
            ♡ Save Moment
          </Button>
          {cur.wild === "heart" ? (
            <Button variant="ghost" disabled={pending} onClick={() => finish("heart")}>
              💝 Heart Skip — lempar lagi
            </Button>
          ) : (
            <Button variant="ghost" disabled={pending} onClick={() => finish("skip")}>
              Skip →
            </Button>
          )}
        </div>
      )}
      {mine && <p className="mt-3 font-mono text-[11px] text-ink-faint">skip itu boleh. tidak ada hukuman, tidak ada skor.</p>}
    </motion.section>
  );
}

/* -------------------------------------------------- legend & history -- */

function Legend() {
  return (
    <details className="group rounded-3xl border border-rule bg-paper px-5 py-4">
      <summary className="cursor-pointer list-none text-sm text-ink-soft">
        <span className="font-mono text-[11px] text-ink-faint">01–06</span> · enam sisi dadu{" "}
        <span className="text-ink-faint group-open:hidden">▾</span>
      </summary>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATEGORIES.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-sm">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs" style={{ background: c.tint, color: c.ink }}>
              {c.face}
            </span>
            <span className="text-ink">
              {c.name}
              <span className="block text-xs text-ink-faint">{c.line}</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function History({
  view,
  nameOf,
  onResult,
}: {
  view: DiceView;
  nameOf: (id: string | null) => string;
  onResult: (r: DiceResult) => void;
}) {
  const [pending, start] = useTransition();
  if (!view.recent.length) return null;
  return (
    <PaperCard>
      <Eyebrow>baru saja</Eyebrow>
      <ul className="mt-3 space-y-3">
        {view.recent.map((t) => {
          const c = categoryOf(t.category);
          return (
            <li key={t.id} className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.ink }} />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm text-ink", t.status === "skipped" && "text-ink-faint line-through decoration-ink-faint/40")}>
                  {t.texts[0]}
                </p>
                {t.answer && <p className="mt-0.5 font-hand text-lg leading-tight text-ink-soft">“{t.answer}”</p>}
                <p className="font-mono text-[11px] text-ink-faint">
                  {nameOf(t.playerId)} · {t.status === "done" ? "selesai" : "dilewati"}
                  {t.wild ? ` · ${WILDS[t.wild as keyof typeof WILDS]?.name ?? ""}` : ""}
                </p>
              </div>
              {t.status === "done" &&
                (t.saved ? (
                  <span className="text-sm text-accent-ink" title="Tersimpan di Our Dice Memories">
                    ♥
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    className="text-sm text-ink-faint transition hover:scale-110 hover:text-accent-ink"
                    aria-label="Simpan jadi kenangan"
                    onClick={() =>
                      start(async () => {
                        const r = await saveTurn(t.id);
                        onResult(r.error ? r : await getDiceState(view.id));
                      })
                    }
                  >
                    ♡
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
    </PaperCard>
  );
}

/* ------------------------------------------------------------ ended -- */

function Ended({ view }: { view: DiceView }) {
  const top = Object.entries(view.byCategory).sort((a, b) => b[1] - a[1]);
  return (
    <PaperCard className="text-center">
      <Eyebrow>permainan selesai</Eyebrow>
      <p className="mt-3 font-display text-3xl text-ink">
        {view.doneCount ? `${view.doneCount} hal kecil tentang kita.` : "Sampai lain kali ♡"}
      </p>
      {view.skipCount > 0 && <p className="mt-1 font-mono text-[11px] text-ink-faint">{view.skipCount} dilewati — dan itu tidak apa-apa.</p>}
      {top.length > 0 && (
        <ul className="mx-auto mt-5 max-w-xs space-y-1.5 text-left">
          {top.map(([k, n]) => {
            const c = categoryOf(k);
            return (
              <li key={k} className="flex items-center justify-between rounded-xl px-3 py-1.5 text-sm" style={{ background: c.tint, color: "#4a2b30" }}>
                <span>
                  {c.icon} {c.name}
                </span>
                <span className="font-mono text-xs">{n}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/dice/memories" className="inline-flex h-11 items-center rounded-full border border-rule bg-paper px-6 text-[15px] text-ink transition hover:-translate-y-px">
          Our Dice Memories
        </Link>
        <Link href="/dice" className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-[15px] font-medium text-[#4a2b30] shadow-[var(--shadow-lift)] transition hover:-translate-y-px">
          Main lagi 🎲
        </Link>
      </div>
    </PaperCard>
  );
}

/* ------------------------------------------------- ular tangga ended -- */

function BoardEnded({
  view,
  faces,
  nameOf,
  onResult,
}: {
  view: DiceView;
  faces: Faces;
  nameOf: (id: string | null) => string;
  onResult: (r: DiceResult) => void;
}) {
  const reduce = useReducedMotion();
  const [pending, start] = useTransition();
  const iWon = view.winner === view.selfId;
  const loser = iWon ? view.partnerName : "kamu";
  const pawns: Pawn[] = [
    { id: view.selfId, name: faces.me.name, avatar: faces.me.avatar, color: "#D99AA8", at: view.positions[view.selfId] ?? 0 },
    { id: view.partnerId, name: view.partnerName, avatar: faces.partner.avatar, color: "#8D6E52", at: view.positions[view.partnerId] ?? 0 },
  ];
  return (
    <div className="space-y-5">
      <PaperCard className="text-center">
        <Eyebrow>🏁 sampai di kotak 30</Eyebrow>
        <motion.p
          initial={reduce ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-3 font-display text-3xl text-ink"
        >
          {iWon ? "Kamu sampai duluan! 🏆" : `${nameOf(view.winner)} sampai duluan 🏆`}
        </motion.p>
        <div className="mt-5">
          <SnakeBoard pawns={pawns} activeId={view.winner} />
        </div>
      </PaperCard>

      {view.prize && (
        <section className="rounded-[28px] border border-accent/50 bg-gradient-to-br from-blush/50 to-paper p-6 text-center shadow-[var(--shadow-lift)]">
          <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">hadiah manis untuk {loser}</p>
          <p className="mt-3 font-display text-2xl leading-snug text-ink">{view.prize}</p>
          {view.prizeDone ? (
            <p className="mt-4 font-hand text-2xl text-accent-ink">sudah dikerjakan ♡</p>
          ) : (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {!iWon && (
                <Button disabled={pending} onClick={() => start(async () => onResult(await prizeAction(view.id, "done")))}>
                  Sudah kulakukan ♡
                </Button>
              )}
              <Button variant="ghost" disabled={pending} onClick={() => start(async () => onResult(await prizeAction(view.id, "swap")))}>
                🎲 ganti yang lain
              </Button>
            </div>
          )}
          {iWon && !view.prizeDone && <p className="mt-3 text-sm text-ink-soft">Menunggu {view.partnerName} mengerjakannya…</p>}
        </section>
      )}
      <Ended view={view} />
    </div>
  );
}
