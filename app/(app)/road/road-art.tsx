"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ArtKey } from "./road-config";

// 🛤️ Ilustrasi garis minimalis untuk THE ROAD THAT MADE ME. Semua coretan garis
// (bukan foto). Duduk di atas latar malam→pagi, jadi warnanya mengikuti
// currentColor (disetel terang oleh road.tsx), dengan sedikit aksen eksplisit.

const STROKE = 1.6;

function Draw({
  d,
  delay = 0,
  duration = 1.1,
  reduce,
  ...rest
}: {
  d: string;
  delay?: number;
  duration?: number;
  reduce: boolean | null;
} & Pick<React.SVGProps<SVGPathElement>, "stroke" | "opacity" | "className">) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={reduce ? false : { pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ delay, duration, ease: "easeInOut" }}
      {...rest}
    />
  );
}

const box = "mx-auto mb-9 h-20 w-auto";

// ── satu titik kecil di garis waktu (Where It Started) ────────────────────────
function Spark() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 160 40" className={box} fill="none" aria-hidden>
      <Draw d="M10 24 H150" reduce={reduce} duration={1.6} opacity={0.4} />
      <motion.circle
        cx="40"
        cy="24"
        r="3.5"
        fill="currentColor"
        className="text-[#eda9b2]"
        initial={reduce ? false : { opacity: 0, scale: 0 }}
        animate={reduce ? { opacity: 1 } : { opacity: [0.4, 1, 0.6], scale: 1 }}
        transition={{ delay: 0.4, duration: 2.6, repeat: reduce ? 0 : Infinity }}
      />
    </svg>
  );
}

// ── dua api yang berkobar, lalu satu meredup (Two Fires) ───────────────────────
function TwoFires() {
  const reduce = useReducedMotion();
  const flame = "M0 0 c-5 -8 -2 -13 1 -17 c1 4 4 4 4 9 c3 -3 2 -6 2 -9 c4 5 6 10 6 15 a7 7 0 0 1 -13 2 z";
  return (
    <svg viewBox="0 0 140 70" className={box} fill="none" aria-hidden>
      <Draw d="M14 58 H126" reduce={reduce} duration={1.4} opacity={0.4} />
      {/* api kiri — tetap menyala */}
      <motion.g
        transform="translate(46 56)"
        className="text-[#f0a35a]"
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
        animate={reduce ? undefined : { scaleY: [1, 1.14, 0.94, 1], scaleX: [1, 0.94, 1.05, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d={flame} fill="currentColor" opacity={0.85} transform="translate(-8 -34)" />
      </motion.g>
      {/* api kanan — perlahan padam menjadi bara */}
      <motion.g
        transform="translate(90 56)"
        className="text-[#c77a86]"
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
        animate={reduce ? { opacity: 0.4 } : { scaleY: [1, 0.5, 0.28], opacity: [0.85, 0.5, 0.28] }}
        transition={{ duration: 3.4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
      >
        <path d={flame} fill="currentColor" transform="translate(-8 -34)" />
      </motion.g>
    </svg>
  );
}

// ── formulir / dokumen pendaftaran (The First Thing I Had To Let Go) ───────────
function DocumentSketch() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 120 80" className={box} fill="none" aria-hidden>
      <Draw d="M34 12 h44 l12 12 v44 h-56 z" reduce={reduce} duration={1.4} />
      <Draw d="M78 12 v12 h12" reduce={reduce} delay={0.5} />
      <Draw d="M44 36 h32 M44 46 h32 M44 56 h20" reduce={reduce} delay={0.8} opacity={0.6} />
    </svg>
  );
}

// ── rel kereta + lampu kota (Jakarta / The Last Journey) ───────────────────────
function JourneySketch() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 200 70" className={box} fill="none" aria-hidden>
      {/* rel yang menyempit ke kejauhan */}
      <Draw d="M12 60 L84 22" reduce={reduce} duration={1.6} opacity={0.5} />
      <Draw d="M60 60 L96 22" reduce={reduce} duration={1.6} delay={0.2} opacity={0.5} />
      <Draw d="M20 52 h34 M28 44 h28 M36 36 h20" reduce={reduce} delay={0.6} opacity={0.4} />
      {/* garis cakrawala + lampu kota berkelip */}
      <Draw d="M100 30 H188" reduce={reduce} delay={0.4} opacity={0.4} />
      {[112, 128, 144, 160, 176].map((x, i) => (
        <motion.circle
          key={x}
          cx={x}
          cy={30 - (i % 2) * 6}
          r="1.8"
          fill="currentColor"
          className="text-[#f0c58a]"
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? { opacity: 0.8 } : { opacity: [0.2, 0.9, 0.2] }}
          transition={{ delay: 0.8 + i * 0.2, duration: 3 + i * 0.3, repeat: reduce ? 0 : Infinity }}
        />
      ))}
    </svg>
  );
}

// ── sehelai kain putih (Goodbye, Mom) ─────────────────────────────────────────
function WhiteCloth() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 140 70" className={box} fill="none" aria-hidden>
      <motion.path
        d="M20 30 q14 -10 28 0 q14 10 28 0 q14 -10 28 0 q10 7 16 4 v22 q-6 3 -16 -2 q-14 -8 -28 2 q-14 10 -28 0 q-14 -10 -28 0 z"
        fill="#f2e9dc"
        opacity={0.9}
        stroke="#d8cbb8"
        strokeWidth="1"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 0.9, y: 0 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
      />
    </svg>
  );
}

// ── deretan titik menaik (Somehow, I Found IT) ────────────────────────────────
function Steps() {
  const reduce = useReducedMotion();
  const pts = [
    [24, 56],
    [64, 48],
    [104, 40],
    [144, 30],
  ];
  return (
    <svg viewBox="0 0 170 70" className={box} fill="none" aria-hidden>
      <Draw d="M24 56 L64 48 L104 40 L144 30" reduce={reduce} duration={1.8} opacity={0.5} />
      {pts.map(([cx, cy], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r="3.2"
          fill="currentColor"
          className={i === pts.length - 1 ? "text-[#f0c58a]" : "text-[#cdbfae]"}
          initial={reduce ? false : { opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 + i * 0.35, duration: 0.6 }}
        />
      ))}
    </svg>
  );
}

// ── jalan panjang tanpa ujung (The Road I'm On) ───────────────────────────────
function OpenRoad({ sunrise = false }: { sunrise?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 200 90" className={box} fill="none" aria-hidden>
      {sunrise ? (
        <>
          <motion.circle
            cx="100"
            cy="34"
            r="14"
            fill="#f6c979"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={reduce ? { opacity: 0.9 } : { opacity: [0.7, 1, 0.7], y: 0 }}
            transition={{ duration: 5, repeat: reduce ? 0 : Infinity, ease: "easeInOut" }}
            style={{ filter: "blur(1px)" }}
          />
          <Draw d="M70 34 H130" reduce={reduce} delay={0.6} opacity={0.4} />
        </>
      ) : null}
      {/* jalan yang menyempit ke horizon */}
      <Draw d="M40 84 L96 40" reduce={reduce} duration={1.8} />
      <Draw d="M160 84 L104 40" reduce={reduce} duration={1.8} delay={0.15} />
      {/* garis putus-putus di tengah */}
      {[78, 66, 56, 48].map((y, i) => (
        <motion.line
          key={y}
          x1="100"
          x2="100"
          y1={y}
          y2={y - 5}
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.8 + i * 0.2, duration: 0.6 }}
        />
      ))}
    </svg>
  );
}

// ── dua titik berjalan berdampingan (And Then There's You) ────────────────────
function TwoDots() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 180 60" className={box} fill="none" aria-hidden>
      <Draw d="M16 44 H164" reduce={reduce} duration={1.6} opacity={0.4} />
      <motion.circle
        cy="44"
        r="4.5"
        fill="currentColor"
        initial={reduce ? false : { opacity: 0, cx: 60 }}
        animate={{ opacity: 1, cx: 82 }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      />
      <motion.circle
        cy="44"
        r="4.5"
        fill="currentColor"
        className="text-[#eda9b2]"
        initial={reduce ? false : { opacity: 0, cx: 120 }}
        animate={{ opacity: 1, cx: 98 }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      />
    </svg>
  );
}

// ── dispatcher untuk ilustrasi bab ────────────────────────────────────────────
export function ChapterArt({ art }: { art: ArtKey }) {
  switch (art) {
    case "spark":
      return <Spark />;
    case "two-fires":
      return <TwoFires />;
    case "document":
      return <DocumentSketch />;
    case "journey":
      return <JourneySketch />;
    case "white-cloth":
      return <WhiteCloth />;
    case "steps":
      return <Steps />;
    case "road":
      return <OpenRoad />;
    case "two-dots":
      return <TwoDots />;
    case "sunrise":
      return <OpenRoad sunrise />;
    default:
      return null;
  }
}

// ── jalan berdampingan untuk layar pertanyaan ─────────────────────────────────
export function QuestionRoad() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 220 90" className="mx-auto mb-8 h-24 w-auto text-[#cdbfae]" fill="none" aria-hidden>
      <Draw d="M40 84 L104 36" reduce={reduce} duration={1.8} opacity={0.6} />
      <Draw d="M180 84 L116 36" reduce={reduce} duration={1.8} delay={0.15} opacity={0.6} />
      {/* dua sosok berdampingan, sedikit berjalan menjauh */}
      <motion.circle
        cx="102"
        cy="66"
        r="4"
        fill="currentColor"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 1 }}
      />
      <motion.circle
        cx="118"
        cy="66"
        r="4"
        fill="currentColor"
        className="text-[#eda9b2]"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 1 }}
      />
    </svg>
  );
}

// ── 🏠 rumah kecil yang terbangun bertahap (penutup "tetap berjalan") ──────────
// `step` menaik 0..5: jalan → dua kursi → meja → tanaman → rumah → lampu menyala.
export function HomeBuilding({ step }: { step: number }) {
  const reduce = useReducedMotion();
  const show = (n: number) => ({
    initial: reduce ? false : { opacity: 0, y: 6 },
    animate: { opacity: step >= n ? 1 : 0, y: 0 },
    transition: { duration: 1.1, ease: "easeInOut" as const },
  });

  return (
    <svg
      viewBox="0 0 400 220"
      className="h-full w-full text-[#f4ead9]"
      fill="none"
      aria-hidden
      preserveAspectRatio="xMidYMax meet"
    >
      {/* tanah + jalan setapak (selalu ada) */}
      <motion.g {...show(0)}>
        <Draw d="M20 190 H380" reduce={reduce} duration={1.6} opacity={0.6} />
        <Draw d="M200 190 L176 218 M200 190 L224 218" reduce={reduce} delay={0.3} opacity={0.5} />
      </motion.g>

      {/* dua kursi kecil menghadap satu sama lain */}
      <motion.g {...show(1)} className="text-[#cdbfae]">
        <Draw d="M150 190 v-14 M150 176 h10 v14 M150 176 v-8" reduce={reduce} stroke="currentColor" />
        <Draw d="M250 190 v-14 M250 176 h-10 v14 M250 176 v-8" reduce={reduce} delay={0.2} stroke="currentColor" />
      </motion.g>

      {/* meja kecil di antaranya */}
      <motion.g {...show(2)} className="text-[#cdbfae]">
        <Draw d="M182 178 h36 M186 178 v12 M214 178 v12" reduce={reduce} stroke="currentColor" />
      </motion.g>

      {/* tanaman yang mengapit */}
      <motion.g {...show(3)} className="text-[#c98f97]">
        <Draw d="M96 190 v-16 M96 180 l-6 -4 M96 184 l6 -5" reduce={reduce} stroke="currentColor" />
        <Draw d="M312 190 v-18 M312 178 l-6 -4 M312 182 l6 -5" reduce={reduce} delay={0.2} stroke="currentColor" />
      </motion.g>

      {/* rumah kecil */}
      <motion.g {...show(4)}>
        <Draw d="M150 176 V120 H250 V176" reduce={reduce} duration={1.4} />
        <Draw d="M138 122 L200 80 L262 122 Z" reduce={reduce} delay={0.4} duration={1.4} />
        <Draw d="M190 176 V140 h20 V176" reduce={reduce} delay={0.8} />
      </motion.g>

      {/* lampu jendela menyala hangat */}
      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: step >= 5 ? 1 : 0 }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      >
        <motion.circle
          cx="170"
          cy="138"
          r="22"
          fill="#ffd79a"
          animate={reduce ? undefined : { opacity: [0.55, 0.95, 0.55] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ filter: "blur(4px)" }}
        />
        <rect x="160" y="128" width="20" height="20" rx="1.5" fill="#ffdca6" opacity={0.95} />
        <Draw d="M160 128 h20 v20 h-20 z M170 128 v20 M160 138 h20" reduce={reduce} stroke="#8a6a3e" />
      </motion.g>

      {/* dua sosok kecil di depan pintu, muncul saat lampu menyala */}
      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: step >= 5 ? 0.9 : 0 }}
        transition={{ delay: 0.6, duration: 1.2 }}
      >
        <circle cx="228" cy="184" r="3.2" fill="currentColor" />
        <circle cx="238" cy="184" r="3.2" fill="#eda9b2" />
      </motion.g>
    </svg>
  );
}
