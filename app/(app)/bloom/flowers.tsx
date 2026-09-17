"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * The blooming scene: a little cluster of flowers that grow from the ground,
 * plus petals drifting down. Pure presentation — no data, no side effects.
 */

type FlowerSpec = {
  /** horizontal position within the row, 0–1 (just for gentle spread) */
  petalColor: string;
  centerColor: string;
  size: number; // px, the flower head + stem box
  petals: number;
  delay: number; // seconds before this flower starts growing
  sway: number; // degrees of idle sway
};

// The cluster. Colors lean on the app's blush/accent palette so it feels native.
const FLOWERS: FlowerSpec[] = [
  { petalColor: "#f0a9b5", centerColor: "#f7d774", size: 150, petals: 8, delay: 0.1, sway: 2.5 },
  { petalColor: "#e8b4b8", centerColor: "#f4c95d", size: 210, petals: 9, delay: 0.0, sway: 1.6 },
  { petalColor: "#f6c9cf", centerColor: "#f7d774", size: 130, petals: 7, delay: 0.25, sway: 3 },
];

function Flower({ spec, reduce }: { spec: FlowerSpec; reduce: boolean }) {
  const { petalColor, centerColor, size, petals, delay } = spec;
  // Flower head centered at (50,34); stem falls to the bottom of the 100-box.
  const cx = 50;
  const cy = 34;
  const angles = Array.from({ length: petals }, (_, i) => (360 / petals) * i);

  // With reduced motion we skip growth and just show the flower gently.
  const stemAnim = reduce
    ? { pathLength: 1 }
    : { pathLength: 1, transition: { delay, duration: 0.9, ease: "easeOut" as const } };

  return (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ overflow: "visible", transformOrigin: "50% 100%" }}
      initial={reduce ? false : { rotate: -spec.sway }}
      animate={reduce ? undefined : { rotate: [-spec.sway, spec.sway, -spec.sway] }}
      transition={
        reduce
          ? undefined
          : { delay: delay + 1.4, duration: 5.5, repeat: Infinity, ease: "easeInOut" }
      }
      aria-hidden
    >
      {/* stem */}
      <motion.path
        d={`M ${cx} 100 C ${cx - 6} 78, ${cx + 5} 58, ${cx} ${cy + 6}`}
        fill="none"
        stroke="#8fae6a"
        strokeWidth={3.2}
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={stemAnim}
      />
      {/* leaves */}
      <motion.path
        d={`M ${cx - 1} 74 C ${cx - 20} 68, ${cx - 22} 82, ${cx - 1} 82 Z`}
        fill="#9cbb72"
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduce ? undefined : { delay: delay + 0.6, duration: 0.5 }}
        style={{ transformOrigin: `${cx - 12}px 78px` }}
      />
      <motion.path
        d={`M ${cx + 1} 66 C ${cx + 20} 60, ${cx + 22} 74, ${cx + 1} 74 Z`}
        fill="#8fae6a"
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduce ? undefined : { delay: delay + 0.75, duration: 0.5 }}
        style={{ transformOrigin: `${cx + 12}px 70px` }}
      />
      {/* petals — each unfurls with a little stagger */}
      {angles.map((a, i) => (
        <motion.g
          key={i}
          transform={`rotate(${a} ${cx} ${cy})`}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            reduce
              ? undefined
              : {
                  delay: delay + 0.95 + i * 0.06,
                  duration: 0.55,
                  ease: [0.34, 1.56, 0.64, 1], // gentle overshoot, like unfurling
                }
          }
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
          <ellipse cx={cx} cy={cy - 15} rx={7.5} ry={15} fill={petalColor} />
          <ellipse cx={cx} cy={cy - 17} rx={3.5} ry={8} fill="#ffffff" opacity={0.18} />
        </motion.g>
      ))}
      {/* center */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={9}
        fill={centerColor}
        initial={reduce ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={
          reduce ? undefined : { delay: delay + 1.5, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
        }
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
    </motion.svg>
  );
}

// A handful of petals drifting down after the bloom. Deterministic positions so
// server and client render the same thing (no hydration mismatch).
const DRIFT = [
  { left: "12%", size: 16, dur: 7.5, delay: 1.8, color: "#f0a9b5", drift: 30 },
  { left: "26%", size: 12, dur: 9, delay: 3.2, color: "#f6c9cf", drift: -24 },
  { left: "44%", size: 18, dur: 8, delay: 2.4, color: "#e8b4b8", drift: 18 },
  { left: "61%", size: 13, dur: 10, delay: 4, color: "#f0a9b5", drift: -34 },
  { left: "74%", size: 15, dur: 8.5, delay: 2.9, color: "#f6c9cf", drift: 26 },
  { left: "88%", size: 11, dur: 9.5, delay: 3.6, color: "#e8b4b8", drift: -16 },
];

function Petal({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2C7 6 4 11 12 22C20 11 17 6 12 2Z" fill={color} />
    </svg>
  );
}

export function BloomScene({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <div className={className}>
      {/* drifting petals */}
      {!reduce &&
        DRIFT.map((p, i) => (
          <motion.div
            key={i}
            className="pointer-events-none absolute top-[-8%]"
            style={{ left: p.left }}
            initial={{ y: "-10vh", opacity: 0, rotate: 0 }}
            animate={{ y: "115vh", opacity: [0, 1, 1, 0], rotate: p.drift * 12, x: p.drift }}
            transition={{ delay: p.delay, duration: p.dur, repeat: Infinity, ease: "linear" }}
          >
            <Petal color={p.color} size={p.size} />
          </motion.div>
        ))}

      {/* the flowers, standing on the ground */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-[-1rem] pb-2">
        {FLOWERS.map((spec, i) => (
          <div
            key={i}
            style={{ marginInline: i === 1 ? "-1.5rem" : "-1rem" }}
            className="flex items-end"
          >
            <Flower spec={spec} reduce={!!reduce} />
          </div>
        ))}
      </div>
    </div>
  );
}
