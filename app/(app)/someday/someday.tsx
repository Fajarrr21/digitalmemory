"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  somedayConfig,
  type Chapter,
  type ProseChapter,
  type CardsChapter,
  type PolaroidChapter,
  type ChecklistChapter,
} from "./someday-config";

const { opening, chapters, ending, song, ui } = somedayConfig;

// Semua "layar": pembuka → bab-bab → penutup.
const TOTAL = chapters.length + 2;
const hasSong = song.youtubeId.length > 0;

// Partikel-partikel kecil melayang (statis biar tak bentrok saat hydrate).
const PARTICLES = [
  { left: "8%", size: 3, delay: 0, dur: 11, drift: 16 },
  { left: "18%", size: 2, delay: 2.5, dur: 14, drift: -12 },
  { left: "27%", size: 4, delay: 1.2, dur: 12, drift: 10 },
  { left: "39%", size: 2, delay: 3.4, dur: 15, drift: -18 },
  { left: "52%", size: 3, delay: 0.8, dur: 13, drift: 14 },
  { left: "63%", size: 2, delay: 4.1, dur: 16, drift: -10 },
  { left: "71%", size: 4, delay: 2.0, dur: 11.5, drift: 12 },
  { left: "82%", size: 2, delay: 1.6, dur: 14.5, drift: -14 },
  { left: "91%", size: 3, delay: 3.0, dur: 12.5, drift: 8 },
];

// ── util kecil ────────────────────────────────────────────────────────────────

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

// Petunjuk ketuk / tombol lanjut yang berdenyut halus di bawah tiap layar.
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

// Nomor + judul bab, gaya sampul buku.
function ChapterHead({ ch }: { ch: Chapter }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="mb-8"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-ink-faint">
        {ch.no ? `${ch.no} — ${ch.title}` : ch.title}
      </p>
      {ch.subtitle ? (
        <p className="mt-2 font-hand text-xl text-accent-ink">{ch.subtitle}</p>
      ) : null}
    </motion.div>
  );
}

// Ilustrasi garis abstrak — dua cangkir di atas meja (bukan foto orang).
function TwoCups() {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 120 60"
      className="mx-auto mb-8 h-16 w-auto text-ink-faint"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 0.8, y: 0 }}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      {/* meja */}
      <path d="M10 46h100" />
      {/* cangkir kiri */}
      <path d="M34 30h16v8a8 8 0 0 1-16 0z" />
      <path d="M50 32a4 4 0 0 1 0 8" />
      <path d="M40 26c-1-2 1-3 0-5M46 26c-1-2 1-3 0-5" />
      {/* cangkir kanan */}
      <path d="M72 32h13v6a6.5 6.5 0 0 1-13 0z" />
      <path d="M85 33a3.2 3.2 0 0 1 0 6.4" />
      <path d="M77 29c-.8-1.6.8-2.4 0-4M82 29c-.8-1.6.8-2.4 0-4" />
    </motion.svg>
  );
}

// ── layar pembuka ─────────────────────────────────────────────────────────────

function OpeningScene({ onBegin }: { onBegin: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0); // berapa baris pembuka yang sudah muncul
  const revealed = opening.lines.slice(0, n);
  const done = n >= opening.lines.length;

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-8 text-center">
      <motion.h1
        className="font-display text-[1.7rem] font-medium tracking-[0.18em] text-ink sm:text-3xl"
        initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        {opening.title}
      </motion.h1>
      <motion.p
        className="mt-3 font-hand text-2xl text-accent-ink"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 1, duration: 1.2 }}
      >
        {opening.tagline}
      </motion.p>

      {/* baris pembuka muncul menumpuk */}
      <div className="mt-10 flex min-h-[6.5rem] max-w-md flex-col items-center gap-4">
        {revealed.map((line, i) => (
          <motion.p
            key={i}
            className="whitespace-pre-line text-pretty text-[15px] leading-relaxed text-ink-soft"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
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
          transition={{ delay: 0.3, duration: 0.7 }}
        >
          {opening.beginLabel}
        </motion.button>
      ) : (
        <button
          type="button"
          onClick={() => setN((v) => v + 1)}
          aria-label="lanjut"
          className="mt-2"
        >
          <TapHint label={ui.tapHint} />
        </button>
      )}
    </div>
  );
}

// ── bab prosa (ketuk untuk buka baris demi baris) ─────────────────────────────

function ProseScene({ ch, onNext }: { ch: ProseChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(1);
  const shown = ch.beats.slice(0, n);
  const done = n >= ch.beats.length;
  const intimate = ch.mood === "intimate";

  function tap() {
    if (done) onNext();
    else setN((v) => v + 1);
  }

  return (
    <button
      type="button"
      onClick={tap}
      aria-label={done ? ui.continueLabel : ui.tapHint}
      className="flex min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div className="mx-auto flex max-w-xl flex-col items-center">
        <ChapterHead ch={ch} />
        {ch.art === "two-cups" ? <TwoCups /> : null}

        <div className="flex flex-col items-center gap-6">
          {shown.map((beat, i) => (
            <motion.p
              key={i}
              className={
                intimate
                  ? "max-w-prose whitespace-pre-line text-balance font-display text-[1.35rem] leading-relaxed text-accent-ink sm:text-2xl"
                  : "max-w-prose whitespace-pre-line text-balance font-display text-[1.35rem] leading-relaxed text-ink sm:text-2xl"
              }
              initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              {beat}
            </motion.p>
          ))}
        </div>

        <TapHint label={done ? ui.continueLabel : ui.tapHint} />
      </div>
    </button>
  );
}

// ── bab kartu (ketuk kartu untuk baca pesannya) ───────────────────────────────

function CardsScene({ ch, onNext }: { ch: CardsChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<Set<number>>(new Set());
  // Sekali semua kartu pernah dibuka, penutup & tombol lanjut menetap
  // (biar tak hilang kalau salah satu kartu ditutup lagi).
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
        <ChapterHead ch={ch} />
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
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  isOpen
                    ? "border-accent-ink/40 bg-note-bg"
                    : "border-rule bg-paper/70 hover:border-accent-ink/30"
                }`}
              >
                <span className="font-hand text-xl text-accent-ink">{card.prompt}</span>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.span
                      className="mt-2 block text-pretty text-sm leading-relaxed text-note-ink"
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                      {card.reply}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {unlocked && ch.closing ? (
            <motion.div
              className="mt-8 flex flex-col items-center gap-4"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {ch.closing.map((line, i) => (
                <p
                  key={i}
                  className="max-w-md whitespace-pre-line text-pretty text-[15px] leading-relaxed text-ink-soft"
                >
                  {line}
                </p>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {unlocked ? (
          <motion.button
            type="button"
            onClick={onNext}
            className="mt-8 rounded-full border border-rule bg-paper/70 px-5 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
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

// ── bab polaroid kosong ───────────────────────────────────────────────────────

function PolaroidScene({ ch, onNext }: { ch: PolaroidChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [kept, setKept] = useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <ChapterHead ch={ch} />
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-ink-faint">
          {ch.intro}
        </p>

        {/* bingkai polaroid kosong, sedikit miring */}
        <motion.div
          className="flex w-56 flex-col rounded-[2px] bg-paper p-3 pb-10 shadow-[var(--shadow-soft)]"
          style={{ rotate: -2.5 }}
          initial={reduce ? false : { opacity: 0, y: 18, rotate: -6 }}
          animate={{ opacity: 1, y: 0, rotate: -2.5 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <div className="flex aspect-square items-center justify-center rounded-[1px] border border-dashed border-rule bg-paper-2/60">
            <span className="font-hand text-lg text-ink-faint">{ch.frameNote}</span>
          </div>
        </motion.div>

        <p className="mt-8 max-w-xs text-pretty text-[15px] leading-relaxed text-ink-soft">
          {ch.caption}
        </p>

        {kept ? (
          <motion.div
            className="mt-8 flex flex-col items-center gap-6"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="font-hand text-2xl text-accent-ink">{ch.thanks}</p>
            <button
              type="button"
              onClick={onNext}
              className="rounded-full border border-rule bg-paper/70 px-5 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
            >
              {ui.continueLabel}
            </button>
          </motion.div>
        ) : (
          <button
            type="button"
            onClick={() => setKept(true)}
            className="mt-8 rounded-full border border-accent-ink/30 bg-note-bg px-6 py-2.5 text-sm text-note-ink transition hover:border-accent-ink/50"
          >
            {ch.buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── bab checklist (sengaja tetap kosong) ──────────────────────────────────────

function ChecklistScene({
  ch,
  onNext,
}: {
  ch: ChecklistChapter;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <ChapterHead ch={ch} />

        <ul className="mt-2 flex w-full flex-col gap-3 text-left">
          {ch.items.map((item, i) => (
            <motion.li
              key={i}
              className="flex items-center gap-3 text-[15px] text-ink-soft"
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduce ? 0 : 0.25 + i * 0.12, duration: 0.6 }}
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-ink-faint/70"
              />
              <span className="text-pretty">{item}</span>
            </motion.li>
          ))}
        </ul>

        <motion.p
          className="mt-9 font-hand text-2xl text-accent-ink"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.35 + ch.items.length * 0.12, duration: 0.9 }}
        >
          {ch.note}
        </motion.p>

        <motion.button
          type="button"
          onClick={onNext}
          className="mt-8 rounded-full border border-rule bg-paper/70 px-5 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.5 + ch.items.length * 0.12, duration: 0.7 }}
        >
          {ui.continueLabel}
        </motion.button>
      </div>
    </div>
  );
}

// ── layar penutup ─────────────────────────────────────────────────────────────

function EndingScene({ onReplay }: { onReplay: () => void }) {
  const reduce = useReducedMotion();
  const maxStep = ending.lines.length + 2;
  const [step, setStep] = useState(0);

  const linesToShow = Math.min(step + 1, ending.lines.length);
  const showList = step >= ending.lines.length;
  const showFinal = step >= ending.lines.length + 1;
  const showEnd = step >= maxStep;
  const dark = Math.min(1, step / maxStep);

  function tap() {
    if (!showEnd) setStep((s) => s + 1);
  }

  return (
    // div (bukan button) karena di dalamnya ada tombol & tautan; ketuk di area
    // mana pun memajukan cerita selama belum sampai akhir.
    <div
      onClick={tap}
      className="relative flex min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center px-6 py-24 text-center"
    >
      {/* layar perlahan menggelap seiring cerita ditutup */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "#17110e" }}
        animate={{ opacity: dark * 0.82 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />

      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-5">
        {ending.lines.slice(0, linesToShow).map((line, i) => (
          <motion.p
            key={i}
            className="text-balance font-display text-2xl leading-relaxed text-ink sm:text-[1.7rem]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            {line}
          </motion.p>
        ))}

        <AnimatePresence>
          {showList ? (
            <motion.ul
              className="mt-2 flex flex-col gap-2"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              {ending.somedayList.map((line, i) => (
                <motion.li
                  key={i}
                  className="font-hand text-2xl text-accent-ink"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : i * 0.5, duration: 0.7 }}
                >
                  {line}
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>

        {showFinal ? (
          <motion.p
            className="mt-3 text-balance font-display text-2xl leading-relaxed text-ink sm:text-[1.7rem]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            {ending.finalLine}
          </motion.p>
        ) : null}

        {showEnd ? (
          <motion.div
            className="mt-6 flex flex-col items-center gap-5"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
          >
            <p className="max-w-md text-pretty text-[15px] leading-relaxed text-ink-soft">
              {ending.closer}
            </p>
            <span className="text-2xl text-accent-ink">{ending.heart}</span>
            <p className="mt-2 max-w-md whitespace-pre-line text-balance font-hand text-2xl text-accent-ink">
              {ending.epigraph}
            </p>
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

export function Someday() {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0); // 0 = pembuka, 1..N = bab, terakhir = penutup
  const [muted, setMuted] = useState(false);
  const ytRef = useRef<HTMLIFrameElement>(null);

  const began = scene >= 1;
  const isEnding = scene === TOTAL - 1;

  function ytCommand(func: "playVideo" | "mute" | "unMute") {
    ytRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*",
    );
  }

  function toggleSound() {
    ytCommand("playVideo");
    if (muted) ytCommand("unMute");
    else ytCommand("mute");
    setMuted((m) => !m);
  }

  const goNext = () => setScene((s) => Math.min(s + 1, TOTAL - 1));
  const goPrev = () => setScene((s) => Math.max(s - 1, 0));
  const replay = () => setScene(0);

  function renderChapter(ch: Chapter) {
    switch (ch.kind) {
      case "prose":
        return <ProseScene ch={ch} onNext={goNext} />;
      case "cards":
        return <CardsScene ch={ch} onNext={goNext} />;
      case "polaroid":
        return <PolaroidScene ch={ch} onNext={goNext} />;
      case "checklist":
        return <ChecklistScene ch={ch} onNext={goNext} />;
    }
  }

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

      {/* atmosfer: cahaya hangat + partikel melayang */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(130% 100% at 50% 0%, var(--blush) 0%, transparent 55%)",
          opacity: 0.5,
        }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-accent-ink/25"
            style={{ left: p.left, top: "70%", width: p.size, height: p.size }}
            animate={
              reduce
                ? undefined
                : { y: [0, -260], x: [0, p.drift, 0], opacity: [0, 0.7, 0] }
            }
            transition={{
              duration: p.dur,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* kembali satu langkah — muncul setelah layar pembuka */}
      {began ? (
        <button
          type="button"
          onClick={goPrev}
          aria-label={ui.back}
          className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-paper/70 text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
