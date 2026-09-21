"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  enoughConfig,
  type Chapter,
  type FearsChapter,
  type MirrorChapter,
  type RevealChapter,
  type CalendarChapter,
  type CrazyChapter,
  type LitanyChapter,
} from "./enough-config";

const { opening, chapters, ending, song, ui } = enoughConfig;

// Semua "layar": pembuka → bab-bab → penutup.
const TOTAL = chapters.length + 2;
const hasSong = song.youtubeId.length > 0;

// Grain/noise halus khas kertas — jadi ciri visual editorial-diary fitur ini.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";

// Gelembung chat "gila" — posisi tetap biar tak bentrok saat hydrate.
const BUBBLE_POS = [
  { left: "10%", top: "10%", rot: -4 },
  { left: "56%", top: "6%", rot: 3 },
  { left: "28%", top: "30%", rot: -2 },
  { left: "62%", top: "36%", rot: 5 },
  { left: "14%", top: "52%", rot: 2 },
  { left: "46%", top: "58%", rot: -3 },
  { left: "68%", top: "62%", rot: 4 },
  { left: "22%", top: "72%", rot: -2 },
];

// ── util ────────────────────────────────────────────────────────────────────

function ytSrc() {
  const p = new URLSearchParams({
    autoplay: "1",
    start: String(song.startSeconds),
    enablejsapi: "1",
    playsinline: "1",
    controls: "0",
    rel: "0",
    modestbranding: "1",
    loop: "1",
    playlist: song.youtubeId, // agar loop=1 bekerja
  });
  return `https://www.youtube.com/embed/${song.youtubeId}?${p.toString()}`;
}

// Volume mengikuti perjalanan emosional: hening di pembuka, naik pelan di
// tengah, sedikit lebih ringan saat bab "gila", lalu intim di penutup.
function volumeForScene(scene: number): number {
  if (scene <= 0) return 0; // pembuka: hening
  if (scene >= TOTAL - 1) return 74; // penutup: paling terisi
  const ch = chapters[scene - 1];
  if (ch?.kind === "crazy") return 44; // sedikit lebih ringan
  const t = (scene - 1) / Math.max(1, TOTAL - 3);
  return Math.round(22 + t * 34); // 22 → 56
}

// Petunjuk ketuk / lanjut yang berdenyut halus.
function TapHint({ label, pulse = true }: { label: string; pulse?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="mt-10 block font-mono text-[11px] tracking-[0.2em] text-ink-faint"
      animate={reduce || !pulse ? undefined : { opacity: [0.35, 1, 0.35] }}
      transition={{ duration: 2.4, repeat: Infinity }}
    >
      {label}
    </motion.span>
  );
}

// Label bab kecil, gaya sampul jurnal.
function Eyebrow({ no, title, subtitle }: { no?: string; title: string; subtitle?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="mb-9"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-ink-faint">
        {no ? `${no} — ${title}` : title}
      </p>
      {subtitle ? <p className="mt-2 font-hand text-xl text-accent-ink">{subtitle}</p> : null}
    </motion.div>
  );
}

// ── 00 · pembuka ("Aku tahu.") ────────────────────────────────────────────────

function OpeningScene({ onBegin }: { onBegin: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const revealed = opening.lines.slice(0, n);
  const done = n >= opening.lines.length;

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-8 text-center">
      <motion.p
        className="font-mono text-[11px] uppercase tracking-[0.34em] text-ink-faint"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
      >
        {opening.eyebrow}
      </motion.p>

      <motion.h1
        className="mt-6 font-display text-5xl font-medium tracking-tight text-ink sm:text-6xl"
        initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      >
        {opening.lead}
      </motion.h1>

      <div className="mt-10 flex min-h-[8rem] max-w-md flex-col items-center gap-5">
        {revealed.map((line, i) => (
          <motion.p
            key={i}
            className="whitespace-pre-line text-pretty text-[15px] leading-relaxed text-ink-soft"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            {line}
          </motion.p>
        ))}
      </div>

      {done ? (
        <motion.button
          type="button"
          onClick={onBegin}
          className="mt-10 rounded-full border border-rule bg-paper/70 px-6 py-2.5 font-display text-base text-ink backdrop-blur transition hover:border-accent-ink/40 hover:text-accent-ink"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          {opening.beginLabel}
        </motion.button>
      ) : (
        <button type="button" onClick={() => setN((v) => v + 1)} aria-label={ui.tapHint} className="mt-2">
          <TapHint label={ui.tapHint} />
        </button>
      )}
    </div>
  );
}

// ── 01 · kartu ketakutan ──────────────────────────────────────────────────────

function FearsScene({ ch, onNext }: { ch: FearsChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [unlocked, setUnlocked] = useState(false);

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      if (next.size >= ch.cards.length) setUnlocked(true);
      return next;
    });
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center">
        <Eyebrow no={ch.no} title={ch.title} />
        {ch.intro ? (
          <p className="mb-8 max-w-md text-pretty text-[15px] leading-relaxed text-ink-soft">
            {ch.intro}
          </p>
        ) : null}

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {ch.cards.map((card, i) => {
            const isOpen = open.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(i)}
                className={`rounded-2xl border px-5 py-5 text-left transition ${
                  isOpen ? "border-accent-ink/40 bg-note-bg" : "border-rule bg-paper/70 hover:border-accent-ink/30"
                }`}
              >
                <span className="font-display text-lg text-ink">{card.fear}</span>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.span
                      className="mt-3 block"
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                    >
                      {card.reply.map((line, k) => (
                        <span
                          key={k}
                          className="mt-1 block text-pretty text-sm leading-relaxed text-note-ink"
                        >
                          {line}
                        </span>
                      ))}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </button>
            );
          })}
        </div>

        {unlocked ? (
          <motion.button
            type="button"
            onClick={onNext}
            className="mt-9 rounded-full border border-rule bg-paper/70 px-5 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            {ui.continueLabel}
          </motion.button>
        ) : (
          <TapHint label={ui.cardHint} />
        )}
      </div>
    </div>
  );
}

// ── 02 · cermin (yang kamu kira ↔ yang aku lihat) ─────────────────────────────

function MirrorScene({ ch, onNext }: { ch: MirrorChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  const wordsFaded = Math.min(step, ch.leftWords.length);
  const rightShown = Math.min(Math.max(0, step - ch.leftWords.length), ch.rightLines.length);
  const showFinal = step >= ch.leftWords.length + ch.rightLines.length;
  const maxStep = ch.leftWords.length + ch.rightLines.length;

  function tap() {
    if (!showFinal) setStep((s) => Math.min(s + 1, maxStep));
  }

  return (
    <div
      onClick={tap}
      className="flex min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-6">
        {/* yang kamu kira — memudar satu per satu */}
        <div className="flex flex-col items-center sm:items-start sm:text-left">
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.28em] text-ink-faint">
            {ch.leftTitle}
          </p>
          <ul className="flex flex-col gap-3">
            {ch.leftWords.map((w, i) => {
              const faded = i < wordsFaded;
              return (
                <motion.li
                  key={i}
                  className="font-display text-2xl text-ink sm:text-[1.7rem]"
                  animate={
                    faded
                      ? reduce
                        ? { opacity: 0.12 }
                        : { opacity: 0.1, filter: "blur(3px)", x: -6, skewX: -6 }
                      : { opacity: 1, filter: "blur(0px)", x: 0, skewX: 0 }
                  }
                  transition={{ duration: 0.9, ease: "easeOut" }}
                >
                  {w}
                </motion.li>
              );
            })}
          </ul>
        </div>

        {/* yang aku lihat — muncul satu per satu */}
        <div className="flex flex-col items-center sm:items-start sm:text-left">
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.28em] text-accent-ink/80">
            {ch.rightTitle}
          </p>
          <ul className="flex flex-col gap-3">
            {ch.rightLines.slice(0, rightShown).map((line, i) => (
              <motion.li
                key={i}
                className="max-w-xs text-pretty font-display text-xl leading-snug text-accent-ink"
                initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                {line}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-12 flex flex-col items-center">
        <AnimatePresence>
          {showFinal ? (
            <motion.p
              key="final"
              className="font-hand text-3xl text-accent-ink"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              {ch.finalLine}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {showFinal ? (
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="mt-9 rounded-full border border-rule bg-paper/70 px-5 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.7 }}
          >
            {ui.continueLabel}
          </motion.button>
        ) : (
          <TapHint label={ui.tapHint} />
        )}
      </div>
    </div>
  );
}

// ── 03 · kamu boleh menunjukkan sisi yang biasanya kamu sembunyikan ───────────

function RevealScene({ ch, onNext }: { ch: RevealChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<number | null>(null);
  const [seen, setSeen] = useState(false);
  const active = selected !== null ? ch.options[selected] : null;

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center">
        <Eyebrow no={ch.no} title={ch.title} />
        <p className="mb-8 max-w-md text-pretty font-display text-lg leading-relaxed text-ink">
          {ch.intro}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {ch.options.map((opt, i) => {
            const isActive = selected === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSelected(i);
                  setSeen(true);
                }}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  isActive
                    ? "border-accent-ink/50 bg-note-bg text-note-ink"
                    : "border-rule bg-paper/70 text-ink-soft hover:border-accent-ink/30 hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex min-h-[5rem] max-w-md flex-col items-center gap-2">
          <AnimatePresence mode="wait">
            {active ? (
              <motion.div
                key={selected}
                className="flex flex-col gap-2"
                initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                {active.reply.map((line, k) => (
                  <p key={k} className="text-pretty text-[15px] leading-relaxed text-accent-ink">
                    {line}
                  </p>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {seen ? (
          <motion.div
            className="flex flex-col items-center gap-6"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
          >
            {ch.closing ? (
              <p className="max-w-md text-pretty text-[15px] leading-relaxed text-ink-soft">
                {ch.closing}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onNext}
              className="rounded-full border border-rule bg-paper/70 px-5 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
            >
              {ui.continueLabel}
            </button>
          </motion.div>
        ) : (
          <TapHint label={ui.revealHint} />
        )}
      </div>
    </div>
  );
}

// ── 04 · even on those days (kalender yang semuanya tercentang) ────────────────

function CalendarScene({ ch, onNext }: { ch: CalendarChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const lastDelay = reduce ? 0 : 0.25 + ch.days.length * 0.18;

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center">
        <Eyebrow no={ch.no} title={ch.title} />

        <ul className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
          {ch.days.map((day, i) => (
            <motion.li
              key={i}
              className="flex items-center justify-between rounded-xl border border-rule bg-paper/70 px-4 py-3 text-left"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.25 + i * 0.18, duration: 0.6 }}
            >
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft">
                {day}
              </span>
              <motion.span
                aria-hidden
                className="text-accent-ink"
                initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: reduce ? 0 : 0.45 + i * 0.18, duration: 0.5, ease: "backOut" }}
              >
                ✓
              </motion.span>
            </motion.li>
          ))}
        </ul>

        <motion.div
          className="mt-9 flex max-w-md flex-col gap-3"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: lastDelay, duration: 0.9 }}
        >
          {ch.closing.map((line, i) => (
            <p key={i} className="text-pretty text-[15px] leading-relaxed text-ink-soft">
              {line}
            </p>
          ))}
        </motion.div>

        <motion.button
          type="button"
          onClick={onNext}
          className="mt-8 rounded-full border border-rule bg-paper/70 px-5 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: lastDelay + 0.4, duration: 0.7 }}
        >
          {ui.continueLabel}
        </motion.button>
      </div>
    </div>
  );
}

// ── 05 · the "crazy" part (gelembung chat → yaudah) ───────────────────────────

function CrazyScene({ ch, onNext }: { ch: CrazyChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"bubbles" | "after">("bubbles");
  const [afterN, setAfterN] = useState(0);

  const afterDone = afterN >= ch.afterLines.length;

  function tap() {
    if (phase === "bubbles") {
      setPhase("after");
      setAfterN(1);
    } else if (!afterDone) {
      setAfterN((n) => n + 1);
    } else {
      onNext();
    }
  }

  const hintLabel = phase === "bubbles" || !afterDone ? ui.tapHint : ui.continueLabel;

  return (
    <button
      type="button"
      onClick={tap}
      aria-label={hintLabel}
      className="flex min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <motion.p
          className="max-w-lg text-balance font-display text-xl leading-relaxed text-ink sm:text-2xl"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          {ch.title}
        </motion.p>

        {/* area gelembung */}
        <div className="relative mt-8 h-[52vh] w-full max-w-xl">
          {ch.bubbles.map((b, i) => {
            const pos = BUBBLE_POS[i % BUBBLE_POS.length];
            return (
              <motion.span
                key={i}
                className="absolute rounded-2xl rounded-bl-sm border border-rule bg-paper px-3.5 py-2 font-hand text-lg text-accent-ink shadow-[var(--shadow-lift)]"
                style={{ left: pos.left, top: pos.top, rotate: `${pos.rot}deg` }}
                initial={reduce ? false : { opacity: 0, scale: 0.6, y: 8 }}
                animate={
                  phase === "after"
                    ? { opacity: 0.12, scale: 0.96, filter: "blur(2px)" }
                    : { opacity: 1, scale: 1, y: 0 }
                }
                transition={{
                  delay: phase === "after" ? 0 : reduce ? 0 : 0.3 + i * 0.45,
                  duration: 0.6,
                  ease: "easeOut",
                }}
              >
                {b}
              </motion.span>
            );
          })}

          {/* kata-kata penutup muncul di tengah setelah gelembung berhenti */}
          {phase === "after" ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
              {ch.afterLines.slice(0, afterN).map((line, i) => {
                const isLast = i === ch.afterLines.length - 1;
                return (
                  <motion.p
                    key={i}
                    className={
                      isLast
                        ? "font-hand text-3xl text-accent-ink"
                        : "font-display text-2xl text-ink"
                    }
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    {line}
                  </motion.p>
                );
              })}
            </div>
          ) : null}
        </div>

        <TapHint label={hintLabel} />
      </div>
    </button>
  );
}

// ── 06 & 07 · litani (convince / promise) ─────────────────────────────────────

function LitanyScene({ ch, onNext }: { ch: LitanyChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const shown = ch.lines.slice(0, n);
  const linesDone = n >= ch.lines.length;
  const [pauseElapsed, setPauseElapsed] = useState(false);

  // Bab tanpa jeda menampilkan finale langsung; yang pakai jeda menunggu timer.
  const showFinale = linesDone && (!ch.pauseBeforeFinale || reduce || pauseElapsed);

  // Jeda kecil sebelum finale (khusus bab dengan pauseBeforeFinale).
  useEffect(() => {
    if (!linesDone || !ch.pauseBeforeFinale || reduce) return;
    const t = setTimeout(() => setPauseElapsed(true), 1400);
    return () => clearTimeout(t);
  }, [linesDone, ch.pauseBeforeFinale, reduce]);

  function tap() {
    if (!linesDone) setN((v) => v + 1);
    else if (showFinale) onNext();
  }

  return (
    <button
      type="button"
      onClick={tap}
      aria-label={showFinale ? ui.continueLabel : ui.tapHint}
      className="flex min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div className="mx-auto flex max-w-xl flex-col items-center">
        <Eyebrow title={ch.title} />

        {ch.intro ? (
          <p className="mb-8 max-w-md text-balance font-display text-xl leading-relaxed text-ink">
            {ch.intro}
          </p>
        ) : null}

        <div className="flex flex-col items-center gap-4">
          {shown.map((line, i) => (
            <motion.p
              key={i}
              className="max-w-prose text-balance font-display text-[1.35rem] leading-relaxed text-ink-soft sm:text-2xl"
              initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              {line}
            </motion.p>
          ))}
        </div>

        <AnimatePresence>
          {showFinale ? (
            <motion.p
              className="mt-8 text-balance font-hand text-3xl text-accent-ink"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              {ch.finale}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <TapHint label={showFinale ? ui.continueLabel : ui.tapHint} />
      </div>
    </button>
  );
}

// ── 08 · penutup ──────────────────────────────────────────────────────────────

function EndingScene({ onReplay }: { onReplay: () => void }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const maxStep = ending.fades.length + 1; // fades… → come back → final

  const inFades = step < ending.fades.length;
  const showComeBack = step === ending.fades.length;
  const showFinal = step >= maxStep;
  const dark = Math.min(1, step / maxStep);

  function tap() {
    if (!showFinal) setStep((s) => s + 1);
  }

  return (
    <div
      onClick={tap}
      className="relative flex min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center px-6 py-24 text-center"
    >
      {/* layar meredup lembut ke senja hangat — memusatkan "Come back here." */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "#17110e" }}
        animate={{ opacity: dark * 0.5 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />

      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-6">
        {inFades ? (
          <>
            <motion.p
              className="text-balance font-display text-2xl leading-relaxed text-ink sm:text-[1.7rem]"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            >
              {ending.lead}
            </motion.p>
            <div className="flex min-h-[3rem] items-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={step}
                  className="text-balance font-display text-2xl leading-relaxed text-accent-ink sm:text-[1.7rem]"
                  initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(5px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(5px)" }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                >
                  {ending.fades[step]}
                </motion.p>
              </AnimatePresence>
            </div>
          </>
        ) : null}

        {showComeBack ? (
          <motion.p
            className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl"
            initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            {ending.comeBack}
          </motion.p>
        ) : null}

        {showFinal ? (
          <motion.div
            className="flex flex-col items-center gap-6"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.3, ease: "easeOut" }}
          >
            <p className="text-balance font-display text-3xl leading-snug text-ink sm:text-4xl">
              {ending.finalLine}
            </p>
            <span className="text-3xl text-accent-ink">{ending.heart}</span>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReplay();
                }}
                className="rounded-full border border-rule bg-paper/70 px-4 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
              >
                {ending.replayLabel}
              </button>
              <Link
                href="/"
                onClick={(e) => e.stopPropagation()}
                className="rounded-full border border-rule bg-paper/70 px-4 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
              >
                {ending.backLabel}
              </Link>
            </div>
          </motion.div>
        ) : (
          <TapHint label={ui.tapHint} />
        )}
      </div>
    </div>
  );
}

// ── shell utama ───────────────────────────────────────────────────────────────

export function Enough() {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [muted, setMuted] = useState(false);
  const ytRef = useRef<HTMLIFrameElement>(null);

  const began = scene >= 1;

  function ytCommand(func: string, args: unknown[] = []) {
    ytRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  }

  // Volume mengikuti scene; play + (un)mute mengikuti tombol suara.
  useEffect(() => {
    if (!hasSong || !began) return;
    const apply = () => {
      ytCommand("playVideo");
      if (muted) {
        ytCommand("mute");
      } else {
        ytCommand("unMute");
        ytCommand("setVolume", [volumeForScene(scene)]);
      }
    };
    apply();
    // player kadang belum siap sesaat setelah mount — terapkan ulang sekali.
    const t = setTimeout(apply, 900);
    return () => clearTimeout(t);
  }, [scene, began, muted]);

  function toggleSound() {
    setMuted((m) => !m);
  }

  const goNext = () => setScene((s) => Math.min(s + 1, TOTAL - 1));
  const goPrev = () => setScene((s) => Math.max(s - 1, 0));
  const replay = () => setScene(0);

  function renderChapter(ch: Chapter) {
    switch (ch.kind) {
      case "fears":
        return <FearsScene ch={ch} onNext={goNext} />;
      case "mirror":
        return <MirrorScene ch={ch} onNext={goNext} />;
      case "reveal":
        return <RevealScene ch={ch} onNext={goNext} />;
      case "calendar":
        return <CalendarScene ch={ch} onNext={goNext} />;
      case "crazy":
        return <CrazyScene ch={ch} onNext={goNext} />;
      case "litany":
        return <LitanyScene ch={ch} onNext={goNext} />;
    }
  }

  const isEnding = scene === TOTAL - 1;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-ground text-ink">
      {/* lagu tersembunyi — dipasang setelah "Begin" (gesture user) agar autoplay jalan */}
      {hasSong && began ? (
        <iframe
          ref={ytRef}
          title={song.title}
          src={ytSrc()}
          allow="autoplay; encrypted-media"
          className="pointer-events-none fixed bottom-0 left-0 h-px w-px opacity-0"
          aria-hidden
        />
      ) : null}

      {/* cahaya krem hangat dari atas */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(120% 90% at 50% 0%, var(--blush) 0%, transparent 55%)",
          opacity: 0.4,
        }}
      />
      {/* grain kertas — ciri visual editorial-diary */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 mix-blend-soft-light"
        style={{ backgroundImage: GRAIN, opacity: 0.06 }}
      />

      {/* kembali satu langkah */}
      {began ? (
        <button
          type="button"
          onClick={goPrev}
          aria-label={ui.back}
          className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-paper/70 text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      ) : null}

      {/* tombol suara — hanya jika ada lagu */}
      {hasSong && began ? (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? ui.muteOff : ui.muteOn}
          className="fixed right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-paper/70 text-lg backdrop-blur transition hover:border-accent-ink/40"
        >
          {muted ? "🔇" : "🎵"}
        </button>
      ) : null}

      {/* layar aktif */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene}
          className="relative z-10 min-h-[100dvh]"
          initial={reduce ? false : { opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          {scene === 0 ? (
            <OpeningScene onBegin={goNext} />
          ) : isEnding ? (
            <EndingScene onReplay={replay} />
          ) : (
            renderChapter(chapters[scene - 1])
          )}
        </motion.div>
      </AnimatePresence>

      {/* titik-titik progres */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex items-center justify-center gap-1.5">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === scene ? "w-5 bg-accent-ink/70" : "w-1.5 bg-ink-faint/35"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
