"use client";

import { useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { OrbPhase } from "@/lib/care/logic";
import { cn } from "@/lib/utils";

/**
 * Little Care — the room and its Care Orb.
 *
 * A small virtual bedroom at night: a window with the moon, a warm lamp, a
 * blanket, and in the middle a little heart-shaped orb of light. The orb
 * changes a little with the session — waiting, being cared for, resting,
 * done — but that's symbolic only, NEVER a health indicator; the page always
 * says the state in words too. Pure SVG + motion; every loop stops under
 * prefers-reduced-motion.
 */

// A fixed warm-night palette — the room is its own little world in both themes.
const C = {
  cream: "#fff3e4",
  blush: "#f4c7cf",
  pink: "#e8a5b4",
  lamp: "#f6c98d",
  ember: "#e9a66b",
  cocoa: "#3a261d",
  night: "#1f1511",
  blanket: "#8a5a68",
  blanketDeep: "#6b4452",
};

export function CareRoom({
  children,
  dim = false,
  className,
}: {
  children: React.ReactNode;
  dim?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_100%_at_75%_8%,#5a3b2c_0%,#3a261d_48%,#1f1511_100%)] text-[#fff3e4]",
        className,
      )}
    >
      {/* The room — decoration only. */}
      <svg aria-hidden viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full">
        {/* window */}
        <g opacity="0.9">
          <rect x="28" y="30" width="78" height="92" rx="10" fill="#241a2b" stroke={C.cream} strokeOpacity="0.18" />
          <line x1="67" y1="30" x2="67" y2="122" stroke={C.cream} strokeOpacity="0.14" />
          <line x1="28" y1="76" x2="106" y2="76" stroke={C.cream} strokeOpacity="0.14" />
          <circle cx="86" cy="52" r="9" fill={C.cream} opacity="0.85" />
          <circle cx="90" cy="49" r="8" fill="#241a2b" />
          {[
            [44, 46, 1.2],
            [56, 98, 1],
            [92, 104, 1.1],
            [48, 62, 0.8],
          ].map(([x, y, r], i) => (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill={C.cream}
              initial={{ opacity: 0.5 }}
              animate={reduce ? { opacity: 0.6 } : { opacity: [0.25, 0.9, 0.25] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </g>
        {/* lamp + its warm cone */}
        <motion.path
          d="M330 64 L392 250 L268 250 Z"
          fill={C.lamp}
          initial={{ opacity: 0.08 }}
          animate={reduce ? { opacity: 0.1 } : { opacity: [0.07, 0.12, 0.07] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <path d="M312 40 h36 l10 26 h-56 Z" fill={C.ember} opacity="0.9" />
        <line x1="330" y1="66" x2="330" y2="190" stroke={C.cream} strokeOpacity="0.25" strokeWidth="2" />
        <rect x="316" y="188" width="28" height="6" rx="3" fill={C.cream} opacity="0.2" />
        <circle cx="330" cy="70" r="26" fill={C.lamp} opacity="0.18" />
        {/* blanket / bed edge */}
        <path d="M-10 262 C 70 236, 150 248, 210 240 S 330 230, 410 250 L410 310 L-10 310 Z" fill={C.blanketDeep} opacity="0.85" />
        <path d="M-10 276 C 80 256, 160 268, 220 260 S 340 252, 410 270 L410 310 L-10 310 Z" fill={C.blanket} opacity="0.9" />
        <path d="M40 286 q 20 -8 40 0 M150 280 q 20 -8 40 0 M270 278 q 20 -8 40 0" stroke={C.cream} strokeOpacity="0.15" fill="none" />
      </svg>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-[#120b08] transition-opacity duration-[1800ms]",
          dim ? "opacity-45" : "opacity-0",
        )}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

const HEART = "M50 78 C 22 60, 12 44, 22 32 C 31 21, 45 24, 50 35 C 55 24, 69 21, 78 32 C 88 44, 78 60, 50 78 Z";

/** The Care Orb. `phase` is symbolic — the page always says the state in words. */
export function CareOrb({
  phase,
  label,
  className,
}: {
  phase: OrbPhase;
  label: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const resting = phase === "resting";
  const ended = phase === "ended";
  const bright = phase === "cared" ? 1 : phase === "idle" ? 0.9 : resting ? 0.55 : ended ? 0.7 : 0.75;
  const breathe = reduce || ended ? undefined : { scale: [1, resting ? 1.02 : 1.05, 1] };

  return (
    <div role="img" aria-label={label} className={cn("relative mx-auto aspect-square w-full", className)}>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id={`orb-${id}`} cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor={C.cream} />
            <stop offset="45%" stopColor={C.blush} />
            <stop offset="100%" stopColor={C.pink} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`halo-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.lamp} stopOpacity="0.55" />
            <stop offset="100%" stopColor={C.lamp} stopOpacity="0" />
          </radialGradient>
        </defs>

        <motion.circle
          cx="50"
          cy="52"
          r="46"
          fill={`url(#halo-${id})`}
          animate={{ opacity: bright * 0.9 }}
          transition={{ duration: 1.6 }}
        />
        <motion.g
          style={{ originX: "50px", originY: "52px" }}
          animate={breathe ? { ...breathe, opacity: bright } : { opacity: bright }}
          transition={{ duration: resting ? 7 : 4.5, repeat: breathe ? Infinity : 0, ease: "easeInOut" }}
        >
          <circle cx="50" cy="52" r="30" fill={`url(#orb-${id})`} />
          <path d={HEART} transform="translate(25 27) scale(0.5)" fill={C.cream} opacity="0.95" />
        </motion.g>

        {/* Cared for: a small companion light that stays close. */}
        <AnimatePresence>
          {phase === "cared" ? (
            <motion.g
              key="companion"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
            >
              <motion.g
                style={{ originX: "50px", originY: "52px" }}
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              >
                <circle cx="84" cy="40" r="4.5" fill={C.lamp} />
                <circle cx="84" cy="40" r="9" fill={C.lamp} opacity="0.25" />
              </motion.g>
            </motion.g>
          ) : null}
        </AnimatePresence>

        {/* Resting: a little moon, and the orb breathes slower. */}
        {resting ? (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ duration: 1.4 }}>
            <circle cx="78" cy="22" r="6" fill={C.cream} />
            <circle cx="81" cy="20" r="5.4" fill={C.cocoa} />
            <text x="64" y="20" fontSize="6" fill={C.cream} opacity="0.7" fontFamily="var(--font-hand), cursive">
              z
            </text>
          </motion.g>
        ) : null}
      </svg>
    </div>
  );
}

/**
 * A small animation for one gesture. Re-plays whenever `playKey` changes.
 *   hug  — two lights drift toward each other and become a heart
 *   glow — warm rings open outward
 *   star — little stars rise and stay a moment
 */
export function GestureBloom({
  kind,
  playKey,
  className,
}: {
  kind: "hug" | "glow" | "star";
  playKey: string | number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
        <AnimatePresence mode="wait">
          <motion.g key={`${kind}-${playKey}`} initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {kind === "hug" ? (
              reduce ? (
                <path d={HEART} transform="translate(30 30) scale(0.4)" fill={C.blush} opacity="0.9" />
              ) : (
                <>
                  <motion.circle
                    r="5"
                    fill={C.lamp}
                    initial={{ cx: 8, cy: 52, opacity: 0 }}
                    animate={{ cx: 44, cy: 50, opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 1.8, ease: "easeInOut" }}
                  />
                  <motion.circle
                    r="5"
                    fill={C.blush}
                    initial={{ cx: 92, cy: 52, opacity: 0 }}
                    animate={{ cx: 56, cy: 50, opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 1.8, ease: "easeInOut" }}
                  />
                  <motion.path
                    d={HEART}
                    fill="none"
                    stroke={C.cream}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    style={{ originX: "50px", originY: "52px" }}
                    initial={{ pathLength: 0, opacity: 0, scale: 0.6 }}
                    animate={{ pathLength: 1, opacity: [0, 1, 1, 0.85], scale: 0.9 }}
                    transition={{ delay: 1.4, duration: 1.6, ease: "easeOut" }}
                  />
                </>
              )
            ) : null}

            {kind === "glow"
              ? [0, 1, 2].map((i) => (
                  <motion.circle
                    key={i}
                    cx="50"
                    cy="52"
                    fill="none"
                    stroke={C.lamp}
                    strokeWidth="1.5"
                    initial={{ r: 28, opacity: reduce ? 0.5 : 0.8 }}
                    animate={reduce ? { r: 34 + i * 6, opacity: 0.35 } : { r: 50, opacity: 0 }}
                    transition={{ delay: i * 0.6, duration: 2.6, ease: "easeOut" }}
                  />
                ))
              : null}

            {kind === "star"
              ? [
                  [26, 30],
                  [74, 26],
                  [82, 62],
                  [20, 66],
                  [50, 14],
                ].map(([x, y], i) => (
                  <motion.text
                    key={i}
                    x={x}
                    y={y}
                    fontSize="9"
                    textAnchor="middle"
                    fill={C.lamp}
                    initial={{ opacity: 0, y: (y as number) + (reduce ? 0 : 10) }}
                    animate={{ opacity: [0, 1, 0.8], y }}
                    transition={{ delay: i * 0.25, duration: 1.6, ease: "easeOut" }}
                  >
                    ✦
                  </motion.text>
                ))
              : null}
          </motion.g>
        </AnimatePresence>
      </svg>
    </div>
  );
}
