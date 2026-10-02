"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ChapterKind } from "./journey-config";

// 🌙 Ilustrasi garis untuk SEJAUH INI, KITA. Semua coretan garis + titik — bukan
// foto. Duduk di atas latar malam sendiri, jadi warnanya currentColor (disetel
// terang oleh journey.tsx) dengan sedikit aksen eksplisit.

const STROKE = 1.6;
const PINK = "#eda9b2";
const WARM = "#f2c98a";

function Draw({
  d,
  delay = 0,
  duration = 1.1,
  reduce,
  dashed,
  opacity,
  stroke = "currentColor",
}: {
  d: string;
  delay?: number;
  duration?: number;
  reduce: boolean | null;
  dashed?: boolean;
  opacity?: number;
  stroke?: string;
}) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? "3 6" : undefined}
      initial={reduce ? false : { pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: opacity ?? 1 }}
      transition={{ delay, duration, ease: "easeInOut" }}
    />
  );
}

function Dot({
  cx,
  cy,
  color = "currentColor",
  delay = 0,
  reduce,
  r = 4,
}: {
  cx: number;
  cy: number;
  color?: string;
  delay?: number;
  reduce: boolean | null;
  r?: number;
}) {
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={r}
      fill={color}
      initial={reduce ? false : { opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.7, ease: "easeOut" }}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
    />
  );
}

// ── 01 · OPENING — dua titik, dua dunia, lalu satu jalan ──────────────────────
// Titik atas turun perlahan menyusuri garis sampai berada di jalan yang sama:
//                  ●
//                 /
//        ●───────
export function TwoDotsMeeting() {
  const reduce = useReducedMotion();
  // Jalur titik atas: dari (190,26) turun melengkung ke (190,112).
  const descend = "M190 26 C 186 60, 172 84, 190 112";
  return (
    <svg viewBox="0 0 240 140" className="mx-auto h-36 w-auto" fill="none" aria-hidden>
      {/* dua dunia: lingkaran samar di sekitar masing-masing titik */}
      <motion.circle
        cx="52"
        cy="112"
        r="20"
        stroke="currentColor"
        strokeWidth="1"
        opacity={0.18}
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={reduce ? { opacity: 0.18 } : { scale: [0.9, 1.05, 0.9], opacity: [0.1, 0.22, 0.1] }}
        transition={{ duration: 4, repeat: reduce ? 0 : Infinity }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <motion.circle
        cx="190"
        cy="26"
        r="20"
        stroke="currentColor"
        strokeWidth="1"
        opacity={0.18}
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={reduce ? { opacity: 0 } : { scale: [0.9, 1.05, 0.9], opacity: [0.22, 0.1, 0] }}
        transition={{ duration: 4, delay: 0.6 }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      {/* jalan yang perlahan tergambar di antara keduanya */}
      <Draw d={descend} reduce={reduce} delay={1.6} duration={2.2} opacity={0.35} dashed />
      <Draw d="M52 112 H190" reduce={reduce} delay={3.2} duration={1.8} opacity={0.55} />
      {/* titik kiri — sudah di jalannya sendiri */}
      <Dot cx={52} cy={112} reduce={reduce} delay={0.3} color={WARM} />
      {/* titik kanan — turun menyusuri jalur sampai ke jalan yang sama */}
      <motion.circle
        r="4"
        fill={PINK}
        initial={reduce ? false : { cx: 190, cy: 26, opacity: 0 }}
        animate={
          reduce
            ? { cx: 190, cy: 112, opacity: 1 }
            : { cx: [190, 186, 178, 190], cy: [26, 56, 86, 112], opacity: [0, 1, 1, 1] }
        }
        transition={{ delay: 0.8, duration: 3.6, ease: "easeInOut", times: [0, 0.35, 0.7, 1] }}
      />
    </svg>
  );
}

// ── ilustrasi kecil per bab ────────────────────────────────────────────────────
const box = "mx-auto mb-8 h-20 w-auto";

function Beginning() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 180 60" className={box} fill="none" aria-hidden>
      <Draw d="M14 46 H166" reduce={reduce} duration={1.6} opacity={0.4} />
      {/* tunas kecil */}
      <Draw d="M38 46 V32" reduce={reduce} delay={0.6} duration={0.7} stroke="#9fd3a0" />
      <Draw d="M38 36 C 30 34, 28 28, 30 24 C 36 26, 38 30, 38 36" reduce={reduce} delay={1.1} stroke="#9fd3a0" />
      <Draw d="M38 33 C 45 31, 48 26, 46 21 C 40 23, 38 28, 38 33" reduce={reduce} delay={1.3} stroke="#9fd3a0" />
      <Dot cx={112} cy={46} reduce={reduce} delay={1.6} color={WARM} />
      <Dot cx={124} cy={46} reduce={reduce} delay={1.9} color={PINK} />
    </svg>
  );
}

function Hard() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 180 70" className={box} fill="none" aria-hidden>
      {/* awan */}
      <Draw
        d="M58 24 a10 10 0 0 1 18 -8 a13 13 0 0 1 24 2 a9 9 0 0 1 4 17 H62 a8 8 0 0 1 -4 -11 z"
        reduce={reduce}
        duration={1.4}
        opacity={0.6}
      />
      {[66, 78, 90, 102].map((x, i) => (
        <motion.path
          key={x}
          d={`M${x} 42 l-3 8`}
          stroke="currentColor"
          strokeWidth={1.2}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={reduce ? { opacity: 0.5 } : { opacity: [0, 0.7, 0], y: [0, 6, 10] }}
          transition={{ delay: 1 + i * 0.25, duration: 1.2, repeat: reduce ? 0 : Infinity }}
        />
      ))}
      <Draw d="M14 62 H166" reduce={reduce} delay={0.4} duration={1.6} opacity={0.4} />
      <Dot cx={84} cy={62} reduce={reduce} delay={1.4} color={WARM} />
      <Dot cx={95} cy={62} reduce={reduce} delay={1.6} color={PINK} />
    </svg>
  );
}

// Jalan yang terbelah sedikit — masih perjalanan yang sama, tidak selalu berdampingan.
function Far() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 200 90" className={box} fill="none" aria-hidden>
      {/* bulan sabit */}
      <motion.path
        d="M166 14 a12 12 0 1 0 10 18 a9 9 0 1 1 -10 -18 z"
        fill={WARM}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 0.85 }}
        transition={{ delay: 0.3, duration: 1.4 }}
      />
      <Draw d="M10 52 H88" reduce={reduce} duration={1.2} opacity={0.45} />
      <Draw d="M88 52 C 108 52, 116 30, 150 28" reduce={reduce} delay={1} duration={1.2} opacity={0.45} />
      <Draw d="M88 52 C 108 52, 116 74, 150 76" reduce={reduce} delay={1} duration={1.2} opacity={0.45} />
      <Dot cx={150} cy={28} reduce={reduce} delay={2} color={PINK} />
      <Dot cx={150} cy={76} reduce={reduce} delay={2.2} color={WARM} />
      {/* benang tipis yang tetap menghubungkan keduanya */}
      <motion.path
        d="M150 32 V72"
        stroke={PINK}
        strokeWidth={1}
        strokeDasharray="2 5"
        initial={{ opacity: 0 }}
        animate={reduce ? { opacity: 0.5 } : { opacity: [0, 0.6, 0.25, 0.6] }}
        transition={{ delay: 2.6, duration: 4, repeat: reduce ? 0 : Infinity }}
      />
    </svg>
  );
}

function Learned() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 180 60" className={box} fill="none" aria-hidden>
      <Draw d="M14 46 H166" reduce={reduce} duration={1.6} opacity={0.4} />
      {/* daun-daun kecil tumbuh di sepanjang jalan */}
      {[40, 70, 130].map((x, i) => (
        <Draw
          key={x}
          d={`M${x} 46 C ${x - 6} 40, ${x - 4} 34, ${x} 32 C ${x + 4} 34, ${x + 6} 40, ${x} 46`}
          reduce={reduce}
          delay={0.6 + i * 0.3}
          stroke="#9fd3a0"
        />
      ))}
      <Dot cx={96} cy={46} reduce={reduce} delay={1.6} color={WARM} />
      <Dot cx={106} cy={46} reduce={reduce} delay={1.8} color={PINK} />
    </svg>
  );
}

export function ChapterArt({ kind }: { kind: ChapterKind }) {
  switch (kind) {
    case "beginning":
      return <Beginning />;
    case "hard":
      return <Hard />;
    case "far":
      return <Far />;
    case "learned":
      return <Learned />;
    default:
      return null;
  }
}

// ── hujan tipis untuk bab 04 (seluruh layar) ───────────────────────────────────
const DROPS = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: (i * 0.23) % 2.4,
  dur: 1.1 + ((i * 7) % 5) / 10,
  len: 10 + ((i * 3) % 8),
}));

export function Rain() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {DROPS.map((d, i) => (
        <motion.span
          key={i}
          className="absolute top-0 w-px bg-[#cdd6e6]/25"
          style={{ left: d.left, height: d.len }}
          initial={{ y: "-10vh", opacity: 0 }}
          animate={{ y: "110vh", opacity: [0, 0.8, 0.8, 0] }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}

// ── jalan kecil di bawah layar yang memanjang dari bab ke bab ──────────────────
// `emojis` = jejak yang sudah terlewati sampai titik cerita ini.
export function RoadStrip({ emojis, gray = false }: { emojis: string[]; gray?: boolean }) {
  const reduce = useReducedMotion();
  const shown = emojis.slice(-14); // jalannya bisa panjang; layar kecil cukup ujungnya
  const hidden = emojis.length - shown.length;
  return (
    <div
      aria-hidden
      className={`pointer-events-none flex items-center justify-center gap-0 px-4 transition-[filter] duration-1000 ${
        gray ? "grayscale-[70%]" : ""
      }`}
    >
      {hidden > 0 ? <span className="mr-1 font-mono text-[10px] text-[#9a8b7c]">···</span> : null}
      {shown.map((e, i) => (
        <motion.span
          key={`${i}-${e}`}
          className="flex items-center"
          initial={reduce ? false : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: reduce ? 0 : 0.05 * i, duration: 0.5 }}
        >
          <span className="h-px w-3 bg-[#f4ead9]/30 sm:w-5" />
          <span className="text-sm sm:text-base">{e}</span>
        </motion.span>
      ))}
      <span className="h-px w-4 bg-[#f4ead9]/30 sm:w-6" />
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full" style={{ background: WARM }} />
        <span className="h-2 w-2 rounded-full" style={{ background: PINK }} />
      </span>
      <span className="h-px w-8 bg-gradient-to-r from-[#f4ead9]/30 to-transparent" />
    </div>
  );
}

// ── "Look how far we've come" — kamera perlahan zoom out ──────────────────────
// Mula-mula hanya tiga jejak pertama yang terlihat (diperbesar), lalu skala
// turun sampai seluruh jalan masuk ke layar.
export function ZoomOutRoad({ emojis, onDone }: { emojis: string[]; onDone?: () => void }) {
  const reduce = useReducedMotion();
  const n = Math.max(emojis.length, 1);
  // Seberapa besar mula-mula: cukup untuk memperlihatkan ±3 jejak saja.
  const startScale = Math.min(4, Math.max(1, n / 3));
  return (
    <div className="relative w-full overflow-hidden py-6" aria-hidden>
      <motion.div
        className="flex w-full flex-wrap items-center justify-center gap-y-3 px-4"
        style={{ transformOrigin: "0% 0%" }}
        initial={reduce ? false : { scale: startScale, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reduce ? 0 : 4.2, ease: [0.4, 0, 0.2, 1], delay: 0.4 }}
        onAnimationComplete={onDone}
      >
        {emojis.map((e, i) => (
          <span key={i} className="flex items-center">
            <span className="h-px w-3 bg-[#f4ead9]/35" />
            <span className="text-base">{e}</span>
          </span>
        ))}
        <span className="flex items-center">
          <span className="h-px w-4 bg-[#f4ead9]/35" />
          <span className="h-2 w-2 rounded-full" style={{ background: WARM }} />
        </span>
      </motion.div>
    </div>
  );
}

// ── NOW / jalan di depan ─────────────────────────────────────────────────────────
//  🌱──💌──📸──🌷──🎬──🕯️──● ●───────────────
//                          ↑                 ?
//                         NOW
export function NowRoad({
  emojis,
  marker,
  ahead = false,
}: {
  emojis: string[];
  marker: string;
  ahead?: boolean;
}) {
  const reduce = useReducedMotion();
  const tail = emojis.slice(-6);
  return (
    <div className="flex w-full flex-col items-center" aria-hidden>
      <div className="flex w-full max-w-lg items-center justify-center">
        {emojis.length > tail.length ? (
          <span className="mr-1 font-mono text-[10px] text-[#9a8b7c]">···</span>
        ) : null}
        {tail.map((e, i) => (
          <span key={i} className="flex items-center opacity-70">
            <span className="h-px w-3 bg-[#f4ead9]/30 sm:w-5" />
            <span className="text-sm">{e}</span>
          </span>
        ))}
        <span className="h-px w-3 bg-[#f4ead9]/40 sm:w-5" />
        <span className="relative flex flex-col items-center">
          <motion.span
            className="flex items-center gap-1.5"
            animate={reduce ? undefined : { scale: [1, 1.12, 1] }}
            transition={{ duration: 2.6, repeat: Infinity }}
          >
            <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_#f2c98a]" style={{ background: WARM }} />
            <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_#eda9b2]" style={{ background: PINK }} />
          </motion.span>
          <span className="absolute top-5 flex flex-col items-center">
            <span className="text-xs text-[#cdbfae]">↑</span>
            <span className="font-mono text-[10px] tracking-[0.3em] text-[#eda9b2]">{marker}</span>
          </span>
        </span>
        {ahead ? (
          <motion.span
            className="flex items-center"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1.4 }}
          >
            <motion.span
              className="h-px w-20 origin-left border-t border-dashed border-[#f4ead9]/40 sm:w-40"
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 2.4, ease: "easeOut" }}
            />
            <motion.span
              className="ml-2 font-display text-lg text-[#f4ead9]/60"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3, duration: 1.2 }}
            >
              ?
            </motion.span>
          </motion.span>
        ) : null}
      </div>
    </div>
  );
}
