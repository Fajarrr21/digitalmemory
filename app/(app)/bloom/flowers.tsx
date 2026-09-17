"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * The blooming scene, in two acts:
 *   1. a shower of blossoms drifting down from the top, each opening as it falls
 *   2. a single layered rose that unfurls in the centre once the rain is going
 * Pure presentation — no data, no side effects.
 */

// ---- palette -------------------------------------------------------------
type Style = { from: string; to: string; center: string };
const STYLES: Style[] = [
  { from: "#ffe0e7", to: "#ef8ba1", center: "#f6c65b" }, // rose
  { from: "#ffe9f0", to: "#f3a7bc", center: "#f4cf74" }, // blush
  { from: "#ffe8d8", to: "#f5b083", center: "#efb15e" }, // peach
  { from: "#fff7f0", to: "#f6dcc9", center: "#eec27a" }, // cream
  { from: "#f7dcee", to: "#d99fc9", center: "#f2c86a" }, // mauve
];

// A soft 5-petal blossom (sakura-ish, notched tips) with a radial gradient.
function Blossom({ style, size, id }: { style: Style; size: number; id: string }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ overflow: "visible" }} aria-hidden>
      <defs>
        <radialGradient id={`p-${id}`} cx="50%" cy="72%" r="72%">
          <stop offset="0%" stopColor={style.from} />
          <stop offset="100%" stopColor={style.to} />
        </radialGradient>
      </defs>
      {petals.map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path
            d="M0,-4 C -13,-10 -17,-30 -8,-40 C -3,-46 -1,-42 0,-38 C 1,-42 3,-46 8,-40 C 17,-30 13,-10 0,-4 Z"
            fill={`url(#p-${id})`}
          />
          <path
            d="M0,-6 C -5,-12 -6,-26 -2,-34 C 0,-37 0,-37 2,-34 C 6,-26 5,-12 0,-6 Z"
            fill="#ffffff"
            opacity="0.16"
          />
        </g>
      ))}
      <circle r="6.5" fill={style.center} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle
          key={a}
          cx={Math.cos((a * Math.PI) / 180) * 4}
          cy={Math.sin((a * Math.PI) / 180) * 4}
          r="1.5"
          fill="#fff3c9"
        />
      ))}
    </svg>
  );
}

// ---- falling blossoms ----------------------------------------------------
type Fall = {
  left: number;
  size: number;
  dur: number;
  delay: number;
  sway: number;
  spin: number;
  opacity: number;
  blur: number;
  style: number;
};

// Deterministic RNG so server and client generate the same field (no hydration
// mismatch). Seeded once at module load.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FALLING: Fall[] = (() => {
  const rnd = mulberry32(20240917);
  const pick = (min: number, max: number) => min + rnd() * (max - min);
  return Array.from({ length: 26 }, (): Fall => {
    const depth = rnd(); // 0 = far (small, blurred, slow), 1 = near
    const size = 16 + depth * 34;
    return {
      left: pick(-4, 100),
      size,
      dur: 7.5 + (1 - depth) * 6 + pick(-1, 1),
      delay: pick(0, 9),
      sway: pick(18, 60),
      spin: (rnd() > 0.5 ? 1 : -1) * pick(180, 520),
      opacity: 0.55 + depth * 0.45,
      blur: (1 - depth) * 2.4,
      style: Math.floor(rnd() * STYLES.length),
    };
  });
})();

function FallingFlowers({ reduce }: { reduce: boolean }) {
  if (reduce) {
    // A calm, static scatter for reduced-motion.
    return (
      <>
        {FALLING.slice(0, 10).map((f, i) => (
          <div
            key={i}
            className="pointer-events-none absolute"
            style={{ left: `${f.left}%`, top: `${(i * 11) % 90}%`, opacity: f.opacity, filter: f.blur ? `blur(${f.blur}px)` : undefined }}
          >
            <Blossom style={STYLES[f.style]} size={f.size} id={`s${i}`} />
          </div>
        ))}
      </>
    );
  }
  return (
    <>
      {FALLING.map((f, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute top-0"
          style={{ left: `${f.left}%`, filter: f.blur ? `blur(${f.blur}px)` : undefined }}
          initial={{ y: "-18vh", opacity: 0, rotate: 0, scale: 0.5 }}
          animate={{
            y: "116vh",
            opacity: [0, f.opacity, f.opacity, 0],
            rotate: f.spin,
            x: [0, f.sway, -f.sway * 0.7, 0],
            scale: 1,
          }}
          transition={{
            y: { delay: f.delay, duration: f.dur, repeat: Infinity, ease: "linear" },
            opacity: { delay: f.delay, duration: f.dur, repeat: Infinity, ease: "linear", times: [0, 0.12, 0.85, 1] },
            rotate: { delay: f.delay, duration: f.dur, repeat: Infinity, ease: "linear" },
            x: { delay: f.delay, duration: f.dur / 2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
            scale: { delay: f.delay, duration: 1 },
          }}
        >
          <Blossom style={STYLES[f.style]} size={f.size} id={`f${i}`} />
        </motion.div>
      ))}
    </>
  );
}

// ---- centrepiece rose ----------------------------------------------------
const PETAL = "M0,0 C -11,-15 -10,-36 0,-43 C 10,-36 11,-15 0,0 Z";

const RINGS = [
  { count: 9, scale: 1.0, rot: 0, delay: 0.0, grad: "cb-out" },
  { count: 8, scale: 0.74, rot: 22, delay: 0.45, grad: "cb-mid" },
  { count: 6, scale: 0.5, rot: 12, delay: 0.85, grad: "cb-in" },
];

function CenterBloom({ reduce, base = 2.6 }: { reduce: boolean; base?: number }) {
  const spring = [0.34, 1.4, 0.5, 1] as const;
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: reduce ? 0 : base, duration: 0.6 }}
    >
      {/* soft glow behind */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(247,182,200,0.55) 0%, rgba(247,182,200,0) 68%)" }}
        initial={reduce ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: reduce ? 0 : base + 0.6, duration: 1.4 }}
      />
      <motion.svg
        width={280}
        height={280}
        viewBox="-60 -60 120 120"
        style={{ overflow: "visible", filter: "drop-shadow(0 10px 24px rgba(120,40,60,0.25))" }}
        animate={reduce ? undefined : { rotate: [-1.5, 1.5, -1.5], scale: [1, 1.02, 1] }}
        transition={reduce ? undefined : { delay: base + 2, duration: 7, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <defs>
          <radialGradient id="cb-out" cx="50%" cy="78%" r="78%">
            <stop offset="0%" stopColor="#fbd3dd" />
            <stop offset="100%" stopColor="#e97a97" />
          </radialGradient>
          <radialGradient id="cb-mid" cx="50%" cy="78%" r="78%">
            <stop offset="0%" stopColor="#ffdfe8" />
            <stop offset="100%" stopColor="#ee8fa8" />
          </radialGradient>
          <radialGradient id="cb-in" cx="50%" cy="78%" r="78%">
            <stop offset="0%" stopColor="#fff0f4" />
            <stop offset="100%" stopColor="#f2a7bd" />
          </radialGradient>
          <radialGradient id="cb-core" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#ffe9a3" />
            <stop offset="100%" stopColor="#f3b64e" />
          </radialGradient>
        </defs>

        {RINGS.map((ring, ri) =>
          Array.from({ length: ring.count }).map((_, i) => {
            const angle = ring.rot + (360 / ring.count) * i;
            const delay = base + 0.2 + ring.delay + i * 0.05;
            return (
              <motion.g
                key={`${ri}-${i}`}
                transform={`rotate(${angle})`}
                initial={reduce ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: ring.scale, opacity: 1 }}
                transition={reduce ? undefined : { delay, duration: 0.7, ease: spring }}
                style={{ transformOrigin: "0px 0px" }}
              >
                <path d={PETAL} fill={`url(#${ring.grad})`} />
                <path d={PETAL} fill="#ffffff" opacity="0.12" transform="scale(0.6)" />
              </motion.g>
            );
          }),
        )}

        {/* core */}
        <motion.circle
          r="11"
          fill="url(#cb-core)"
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={reduce ? undefined : { delay: base + 1.5, duration: 0.6, ease: spring }}
          style={{ transformOrigin: "0px 0px" }}
        />
      </motion.svg>
    </motion.div>
  );
}

export function BloomScene({ className }: { className?: string }) {
  const reduce = !!useReducedMotion();
  // Memo keeps the falling field stable across re-renders.
  const rain = useMemo(() => <FallingFlowers reduce={reduce} />, [reduce]);
  return (
    <div className={className}>
      {rain}
      <CenterBloom reduce={reduce} />
    </div>
  );
}
