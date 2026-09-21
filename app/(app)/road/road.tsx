"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  roadConfig,
  type Scene,
  type ProseChapter,
  type FrameChapter,
  type ActCardScene,
} from "./road-config";
import { ChapterArt, QuestionRoad, HomeBuilding } from "./road-art";

const { acts, opening, scenes, question, endingStay, endingWait, ui } = roadConfig;

// Indeks layar: 0 = pembuka, 1..S = scenes, lalu pertanyaan, lalu penutup.
const S = scenes.length;
const QUESTION = S + 1;
const ENDING = S + 2;
const TOTAL = S + 3;

type Choice = "none" | "stay" | "wait";

// Palet terang — perjalanan ini selalu di atas latar malam→pagi sendiri,
// jadi kita pakai warna eksplisit (bukan token tema yang ikut light/dark).
const INK = "text-[#f4ead9]";
const SOFT = "text-[#cdbfae]";
const FAINT = "text-[#9a8b7c]";
const ACCENT = "text-[#eda9b2]";
const WARM = "text-[#f2c98a]";
const BTN =
  "rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] px-6 py-2.5 font-display text-[#f4ead9] backdrop-blur transition hover:border-[#eda9b2]/50 hover:text-[#eda9b2]";

const PARTICLES = [
  { left: "10%", size: 2, delay: 0, dur: 13, drift: 14 },
  { left: "22%", size: 3, delay: 2.4, dur: 15, drift: -12 },
  { left: "34%", size: 2, delay: 1.1, dur: 12, drift: 10 },
  { left: "48%", size: 2, delay: 3.2, dur: 16, drift: -16 },
  { left: "61%", size: 3, delay: 0.9, dur: 14, drift: 12 },
  { left: "73%", size: 2, delay: 4.0, dur: 12.5, drift: -10 },
  { left: "86%", size: 2, delay: 1.7, dur: 15.5, drift: 9 },
];

function ytSrc(id: string, muted: boolean) {
  const p = new URLSearchParams({
    autoplay: "1",
    start: "0",
    enablejsapi: "1",
    playsinline: "1",
    controls: "0",
    rel: "0",
    modestbranding: "1",
    loop: "1",
    playlist: id,
    mute: muted ? "1" : "0",
  });
  return `https://www.youtube.com/embed/${id}?${p.toString()}`;
}

// ── util kecil ─────────────────────────────────────────────────────────────────

function TapHint({ label, pulse = true }: { label: string; pulse?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={`mt-10 block font-mono text-[11px] tracking-[0.2em] ${FAINT}`}
      animate={reduce || !pulse ? undefined : { opacity: [0.35, 1, 0.35] }}
      transition={{ duration: 2.4, repeat: Infinity }}
    >
      {label}
    </motion.span>
  );
}

function ChapterHead({ no, title, subtitle }: { no: string; title: string; subtitle?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="mb-8"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <p className={`font-mono text-[11px] uppercase tracking-[0.32em] ${FAINT}`}>
        {no ? `${no} — ${title}` : title}
      </p>
      {subtitle ? <p className={`mt-2 font-hand text-xl ${ACCENT}`}>{subtitle}</p> : null}
    </motion.div>
  );
}

// ── layar pembuka (layar hitam, teks muncul perlahan) ────────────────────────
function OpeningScene({ onBegin }: { onBegin: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const revealed = opening.lines.slice(0, n);
  const done = n >= opening.lines.length;

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center px-8 text-center">
      <motion.h1
        className={`font-display text-[1.6rem] font-medium tracking-[0.16em] ${INK} sm:text-3xl`}
        initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      >
        {opening.title}
      </motion.h1>
      <motion.p
        className={`mt-3 max-w-md text-pretty font-hand text-xl ${ACCENT}`}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 1.1, duration: 1.4 }}
      >
        {opening.tagline}
      </motion.p>

      <div className="mt-10 flex min-h-[7rem] max-w-md flex-col items-center gap-4">
        {revealed.map((line, i) => (
          <motion.p
            key={i}
            className={`whitespace-pre-line text-pretty text-[15px] leading-relaxed ${SOFT}`}
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
          className={`mt-10 text-base ${BTN}`}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          {opening.beginLabel}
        </motion.button>
      ) : (
        <button type="button" onClick={() => setN((v) => v + 1)} aria-label="lanjut">
          <TapHint label={ui.tapHint} />
        </button>
      )}
    </div>
  );
}

// ── kartu babak (jeda antar-akta) ────────────────────────────────────────────
function ActCard({ scene, onNext }: { scene: ActCardScene; onNext: () => void }) {
  const reduce = useReducedMotion();
  const act = acts[scene.act];
  return (
    <button
      type="button"
      onClick={onNext}
      aria-label={ui.continueLabel}
      className="flex min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center px-8 text-center"
    >
      <motion.div
        className="flex max-w-xl flex-col items-center"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <p className={`font-mono text-[11px] uppercase tracking-[0.4em] ${FAINT}`}>{act.label}</p>
        <h2 className={`mt-4 font-display text-3xl ${INK} sm:text-4xl`}>{act.title}</h2>
        <p className={`mt-4 font-hand text-xl ${ACCENT}`}>{act.subtitle}</p>
        {scene.line ? (
          <motion.p
            className={`mt-10 max-w-md whitespace-pre-line text-balance font-display text-lg leading-relaxed ${SOFT}`}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 1.6, duration: 1.6 }}
          >
            {scene.line}
          </motion.p>
        ) : null}
        <TapHint label={ui.continueLabel} />
      </motion.div>
    </button>
  );
}

// ── bab prosa ─────────────────────────────────────────────────────────────────
function ProseScene({ ch, onNext }: { ch: ProseChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(1);
  const shown = ch.beats.slice(0, n);
  const done = n >= ch.beats.length;
  const beatColor = ch.mood === "intimate" ? ACCENT : ch.mood === "hope" ? WARM : INK;

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
        <ChapterHead no={ch.no} title={ch.title} subtitle={ch.subtitle} />
        {ch.art ? (
          <div className={SOFT}>
            <ChapterArt art={ch.art} />
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-6">
          {shown.map((beat, i) => (
            <motion.p
              key={i}
              className={`max-w-prose whitespace-pre-line text-balance font-display text-[1.3rem] leading-relaxed sm:text-2xl ${beatColor}`}
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

// ── bab polaroid kosong (The Graduation She Never Saw) ────────────────────────
function FrameScene({ ch, onNext }: { ch: FrameChapter; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0); // berapa baris "lines" yang sudah muncul
  const shown = ch.lines.slice(0, n);
  const done = n >= ch.lines.length;

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
      <div className="mx-auto flex max-w-md flex-col items-center">
        <ChapterHead no={ch.no} title={ch.title} />

        <div className="mb-8 flex flex-col items-center gap-4">
          {ch.intro.map((line, i) => (
            <motion.p
              key={i}
              className={`max-w-sm whitespace-pre-line text-pretty text-[15px] leading-relaxed ${SOFT}`}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.3 + i * 0.5, duration: 0.9 }}
            >
              {line}
            </motion.p>
          ))}
        </div>

        {/* bingkai polaroid kosong, sedikit miring */}
        <motion.div
          className="flex w-52 flex-col rounded-[2px] bg-[#f4ead9]/95 p-3 pb-9 shadow-[0_20px_45px_-25px_rgba(0,0,0,0.8)]"
          style={{ rotate: -2.5 }}
          initial={reduce ? false : { opacity: 0, y: 18, rotate: -6 }}
          animate={{ opacity: 1, y: 0, rotate: -2.5 }}
          transition={{ delay: reduce ? 0 : 1.4, duration: 1.1, ease: "easeOut" }}
        >
          <div className="flex aspect-square items-center justify-center rounded-[1px] border border-dashed border-[#b8a894] bg-[#e6dac8]">
            <span className="font-hand text-lg" style={{ color: "#a8987f" }}>
              {ch.frameNote}
            </span>
          </div>
        </motion.div>

        <motion.p
          className={`mt-7 max-w-xs text-pretty text-[15px] leading-relaxed ${INK}`}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 2.1, duration: 1 }}
        >
          {ch.caption}
        </motion.p>

        <div className="mt-6 flex flex-col items-center gap-5">
          {shown.map((line, i) => (
            <motion.p
              key={i}
              className={`max-w-sm whitespace-pre-line text-balance font-display text-lg leading-relaxed ${SOFT}`}
              initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              {line}
            </motion.p>
          ))}
        </div>

        <TapHint label={done ? ui.continueLabel : ui.tapHint} />
      </div>
    </button>
  );
}

// ── FINAL — pertanyaan ────────────────────────────────────────────────────────
function QuestionScene({ onChoose }: { onChoose: (c: Choice) => void }) {
  const reduce = useReducedMotion();
  // step 0..lines.length → buka baris; > lines.length → tampilkan pertanyaan.
  const [step, setStep] = useState(0);
  const linesToShow = Math.min(step, question.lines.length);
  const asking = step > question.lines.length;

  function tap() {
    if (!asking) setStep((s) => s + 1);
  }

  return (
    <div
      onClick={tap}
      className="flex min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div className="mx-auto flex max-w-xl flex-col items-center">
        <QuestionRoad />

        <div className="flex flex-col items-center gap-4">
          {question.lines.slice(0, linesToShow).map((line, i) => (
            <motion.p
              key={i}
              className={`max-w-prose whitespace-pre-line text-balance font-display text-xl leading-relaxed ${SOFT}`}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              {line}
            </motion.p>
          ))}
        </div>

        {asking ? (
          <motion.div
            className="mt-8 flex flex-col items-center gap-6"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <p className={`font-hand text-2xl ${ACCENT}`}>{question.prompt}</p>
            <p className={`max-w-md whitespace-pre-line text-balance font-display text-2xl leading-relaxed ${INK}`}>
              {question.question}
            </p>
            <div className="mt-2 flex w-full max-w-sm flex-col items-stretch gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChoose("stay");
                }}
                className={`text-[15px] ${BTN}`}
              >
                {question.stayLabel}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChoose("wait");
                }}
                className="rounded-full border border-[#f4ead9]/15 bg-transparent px-6 py-2.5 text-[15px] text-[#cdbfae] backdrop-blur transition hover:border-[#f4ead9]/30 hover:text-[#f4ead9]"
              >
                {question.waitLabel}
              </button>
            </div>
          </motion.div>
        ) : (
          <TapHint label={ui.tapHint} />
        )}
      </div>
    </div>
  );
}

// ── penutup: "tetap berjalan" (rumah kecil terbangun) ─────────────────────────
function EndingStay({ onReplay }: { onReplay: () => void }) {
  const reduce = useReducedMotion();
  const maxStep = endingStay.lines.length + 2; // + finalLine + closer/tombol
  const [step, setStep] = useState(0);

  const linesToShow = Math.min(step + 1, endingStay.lines.length);
  const showFinal = step >= endingStay.lines.length;
  const showEnd = step >= endingStay.lines.length + 1;
  const homeStep = Math.min(step, 5);

  function tap() {
    if (!showEnd) setStep((s) => s + 1);
  }

  return (
    <div
      onClick={tap}
      className="relative flex min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center px-6 py-24 text-center"
    >
      {/* rumah kecil yang terbangun bertahap, di bawah teks */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[46vh]">
        <HomeBuilding step={homeStep} />
      </div>

      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-5">
        {endingStay.lines.slice(0, linesToShow).map((line, i) => (
          <motion.p
            key={i}
            className={`whitespace-pre-line text-balance font-display text-2xl leading-relaxed sm:text-[1.7rem] ${INK}`}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            {line}
          </motion.p>
        ))}

        {showFinal ? (
          <motion.p
            className={`mt-2 font-hand text-4xl ${ACCENT}`}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1 }}
          >
            {endingStay.finalLine}
          </motion.p>
        ) : null}

        {showEnd ? (
          <motion.div
            className="mt-6 flex flex-col items-center gap-5"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
          >
            <p className={`max-w-md whitespace-pre-line text-pretty font-hand text-2xl ${WARM}`}>
              {endingStay.closer}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReplay();
                }}
                className="rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] px-4 py-2 text-sm text-[#cdbfae] backdrop-blur transition hover:border-[#eda9b2]/40 hover:text-[#f4ead9]"
              >
                {endingStay.replayLabel}
              </button>
              <Link
                href="/"
                onClick={(e) => e.stopPropagation()}
                className="rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] px-4 py-2 text-sm text-[#cdbfae] backdrop-blur transition hover:border-[#eda9b2]/40 hover:text-[#f4ead9]"
              >
                {endingStay.backLabel}
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

// ── penutup: "butuh waktu" (lembut, jalan tetap terbuka) ──────────────────────
function EndingWait({
  onReconsider,
  onReplay,
}: {
  onReconsider: () => void;
  onReplay: () => void;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const linesToShow = Math.min(step + 1, endingWait.lines.length);
  const showFinal = step >= endingWait.lines.length;
  const showEnd = step >= endingWait.lines.length + 1;

  function tap() {
    if (!showEnd) setStep((s) => s + 1);
  }

  return (
    <div
      onClick={tap}
      className="relative flex min-h-[100dvh] w-full cursor-pointer flex-col items-center justify-center px-6 py-24 text-center"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-8 z-0 flex justify-center opacity-70">
        <div className={SOFT}>
          <ChapterArt art="road" />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-5">
        {endingWait.lines.slice(0, linesToShow).map((line, i) => (
          <motion.p
            key={i}
            className={`whitespace-pre-line text-balance font-display text-2xl leading-relaxed sm:text-[1.7rem] ${INK}`}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            {line}
          </motion.p>
        ))}

        {showFinal ? (
          <motion.p
            className={`mt-2 font-hand text-3xl ${ACCENT}`}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1 }}
          >
            {endingWait.finalLine}
          </motion.p>
        ) : null}

        {showEnd ? (
          <motion.div
            className="mt-6 flex flex-col items-center gap-4"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReconsider();
              }}
              className={`text-[15px] ${BTN}`}
            >
              {endingWait.reconsiderLabel}
            </button>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReplay();
                }}
                className="rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] px-4 py-2 text-sm text-[#cdbfae] backdrop-blur transition hover:border-[#eda9b2]/40 hover:text-[#f4ead9]"
              >
                {endingWait.replayLabel}
              </button>
              <Link
                href="/"
                onClick={(e) => e.stopPropagation()}
                className="rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] px-4 py-2 text-sm text-[#cdbfae] backdrop-blur transition hover:border-[#eda9b2]/40 hover:text-[#f4ead9]"
              >
                {endingWait.backLabel}
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

// ── atmosfer: opasitas tiga lapisan langit per fase ───────────────────────────
function atmosphereFor(scene: number, choice: Choice) {
  let phase: "night" | "heavy" | "dawn" | "end";
  if (scene <= 0) phase = "night";
  else if (scene === QUESTION) phase = "dawn";
  else if (scene === ENDING) phase = choice === "stay" ? "end" : "dawn";
  else {
    const s = scenes[scene - 1];
    phase = s.act === 0 ? "night" : s.act === 1 ? "heavy" : "dawn";
  }
  switch (phase) {
    case "night":
      return { night: 1, heavy: 0, dawn: 0 };
    case "heavy":
      return { night: 0.25, heavy: 1, dawn: 0 };
    case "dawn":
      return { night: 0.12, heavy: 0.18, dawn: 0.72 };
    case "end":
      return { night: 0, heavy: 0.05, dawn: 1 };
  }
}

// ── shell utama ─────────────────────────────────────────────────────────────────
export function Road() {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [choice, setChoice] = useState<Choice>("none");
  const [muted, setMuted] = useState(false);
  const ytRef = useRef<HTMLIFrameElement>(null);

  const began = scene >= 1;

  // Indeks lagu untuk layar aktif; -1 = hening.
  function songIndexFor(sc: number): number {
    if (sc <= 0) return -1;
    if (sc === QUESTION || sc === ENDING) return 2;
    const s = scenes[sc - 1];
    if (s.kind === "act" && s.silent) return -1;
    return s.act;
  }

  const songIndex = songIndexFor(scene);
  const hasSong = songIndex >= 0;
  const atmos = atmosphereFor(scene, choice);

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
  const replay = () => {
    setChoice("none");
    setScene(0);
  };

  function renderScene(sc: Scene) {
    switch (sc.kind) {
      case "act":
        return <ActCard scene={sc} onNext={goNext} />;
      case "prose":
        return <ProseScene ch={sc} onNext={goNext} />;
      case "frame":
        return <FrameScene ch={sc} onNext={goNext} />;
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-[#0b0c12] text-[#f4ead9]">
      {/* 🎵 satu lagu per babak — di-remount saat lagu berganti (autoplay setelah gesture) */}
      {hasSong && began ? (
        <iframe
          key={songIndex}
          ref={ytRef}
          title={acts[songIndex].song.title}
          src={ytSrc(acts[songIndex].song.youtubeId, muted)}
          allow="autoplay; encrypted-media"
          className="pointer-events-none fixed bottom-0 left-0 h-px w-px opacity-0"
          aria-hidden
        />
      ) : null}

      {/* langit malam → berat → pagi (tiga lapisan cross-fade) */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 12%, #1b2140 0%, #0b0c12 60%)" }}
        animate={{ opacity: atmos.night }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 30%, #140f0e 0%, #050507 72%)" }}
        animate={{ opacity: atmos.heavy }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(130% 100% at 50% 108%, #f4bd7e 0%, #b57466 34%, #4a2f42 66%, #1a1420 88%)",
        }}
        animate={{ opacity: atmos.dawn }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />

      {/* partikel kecil melayang */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        {PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-[#f2c98a]/25"
            style={{ left: p.left, top: "72%", width: p.size, height: p.size }}
            animate={reduce ? undefined : { y: [0, -280], x: [0, p.drift, 0], opacity: [0, 0.6, 0] }}
            transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* kembali satu langkah */}
      {began ? (
        <button
          type="button"
          onClick={goPrev}
          aria-label={ui.back}
          className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] text-[#cdbfae] backdrop-blur transition hover:border-[#eda9b2]/40 hover:text-[#f4ead9]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      ) : null}

      {/* tombol suara */}
      {hasSong && began ? (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? ui.muteOff : ui.muteOn}
          className="fixed right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] text-lg backdrop-blur transition hover:border-[#eda9b2]/40"
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
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {scene === 0 ? (
            <OpeningScene onBegin={goNext} />
          ) : scene === QUESTION ? (
            <QuestionScene
              onChoose={(c) => {
                setChoice(c);
                setScene(ENDING);
              }}
            />
          ) : scene === ENDING ? (
            choice === "stay" ? (
              <EndingStay onReplay={replay} />
            ) : (
              <EndingWait
                onReconsider={() => setChoice("stay")}
                onReplay={replay}
              />
            )
          ) : (
            renderScene(scenes[scene - 1])
          )}
        </motion.div>
      </AnimatePresence>

      {/* titik-titik progres */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex items-center justify-center gap-1.5">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === scene ? "w-5 bg-[#eda9b2]/80" : "w-1.5 bg-[#f4ead9]/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
