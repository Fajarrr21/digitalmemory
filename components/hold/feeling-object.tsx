"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { HoldAction, HoldGesture } from "@/lib/supabase/database.types";
import type { HoldObject, ObjectState } from "@/lib/hold/logic";
import { cn } from "@/lib/utils";

/**
 * If I Could Hold Your Feelings — the feeling made visible.
 *
 * A small orb of light (`object="orb"`) that becomes one of four objects:
 * the heavy cloud, the little star, the tender heart, the quiet moon. The
 * partner's gesture never makes it disappear — it adds company: a second
 * light beside it, a warm wrap, listening ripples, or a dimmed sky with one
 * small light that stays. Pure SVG + motion; every loop stops under
 * prefers-reduced-motion, and the state is always also said in words by the
 * page (this is decoration with an aria-label, never the only signal).
 */

// A fixed night palette — the scene is its own little sky in both themes.
const C = {
  cream: "#fff3e4",
  blush: "#f4c7cf",
  pink: "#e8a5b4",
  mauve: "#b98aa6",
  plum: "#3a2436",
  warm: "#f6c98d",
  ember: "#e9a66b",
};

export function HoldSky({
  children,
  dim = false,
  className,
}: {
  children: React.ReactNode;
  dim?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_90%_at_50%_15%,#5b3a55_0%,#3a2436_45%,#22151f_100%)] text-[#fff3e4]",
        className,
      )}
    >
      <Dust />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-[#140b12] transition-opacity duration-[1800ms]",
          dim ? "opacity-45" : "opacity-0",
        )}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** A few slow motes of light. Static under reduced motion. */
function Dust() {
  const reduce = useReducedMotion();
  const motes = [
    { x: "12%", y: "22%", s: 3, d: 9 },
    { x: "82%", y: "18%", s: 2, d: 11 },
    { x: "70%", y: "70%", s: 3, d: 13 },
    { x: "22%", y: "78%", s: 2, d: 10 },
    { x: "48%", y: "10%", s: 2, d: 12 },
    { x: "90%", y: "52%", s: 2, d: 14 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {motes.map((m, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-[#fff3e4]"
          style={{ left: m.x, top: m.y, width: m.s, height: m.s }}
          initial={{ opacity: 0.25 }}
          animate={reduce ? { opacity: 0.35 } : { opacity: [0.15, 0.6, 0.15], y: [0, -10, 0] }}
          transition={reduce ? undefined : { duration: m.d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function FeelingObject({
  object,
  state = "waiting",
  action = null,
  gesture = null,
  busy = false,
  intensity = null,
  label,
  className,
}: {
  object: HoldObject | "orb";
  state?: ObjectState;
  /** The partner's gesture (shown once given, or previewed while choosing). */
  action?: HoldAction | null;
  gesture?: HoldGesture | null;
  /** A busier cloud, for "my mind won't slow down". */
  busy?: boolean;
  intensity?: number | null;
  label: string;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/:/g, "");
  const ended = state === "ended";
  const loop = !reduce && !ended;
  // Heavier feelings sit a touch larger — never more than that.
  const scale = 0.92 + ((intensity ?? 2) - 1) * 0.04;

  const breathe = loop
    ? { scale: [scale, scale * 1.035, scale], transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const } }
    : { scale };

  return (
    <svg
      viewBox="0 0 240 200"
      role="img"
      aria-label={label}
      className={cn("h-auto w-full max-w-[22rem]", className)}
    >
      <defs>
        <radialGradient id={`glow-${uid}`}>
          <stop offset="0%" stopColor={C.cream} stopOpacity="0.9" />
          <stop offset="45%" stopColor={C.blush} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C.pink} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`warm-${uid}`}>
          <stop offset="0%" stopColor={C.warm} stopOpacity="0.75" />
          <stop offset="60%" stopColor={C.ember} stopOpacity="0.22" />
          <stop offset="100%" stopColor={C.ember} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`body-${uid}`} cx="45%" cy="40%">
          <stop offset="0%" stopColor={C.cream} stopOpacity="0.95" />
          <stop offset="70%" stopColor={C.blush} stopOpacity="0.75" />
          <stop offset="100%" stopColor={C.mauve} stopOpacity="0.6" />
        </radialGradient>
        <filter id={`soft-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <mask id={`crescent-${uid}`}>
          <rect width="240" height="200" fill="white" />
          <circle cx="134" cy="88" r="34" fill="black" />
        </mask>
      </defs>

      {/* Give Me Warmth — the warm light wraps around, it doesn't replace. */}
      {action === "warmth" ? (
        <motion.g
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: ended ? 0.6 : 1, scale: 1 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          style={{ transformOrigin: "120px 100px" }}
        >
          <circle cx="120" cy="100" r="92" fill={`url(#warm-${uid})`} />
          {gesture === "wrap" ? (
            <path
              d="M58 118 C 80 150, 160 150, 182 118 C 168 140, 72 140, 58 118 Z"
              fill={C.warm}
              opacity="0.55"
              filter={`url(#soft-${uid})`}
            />
          ) : null}
          {gesture === "hand" ? (
            <g stroke={C.warm} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.8">
              <path d="M62 128 C 78 160, 112 162, 118 150" />
              <path d="M178 128 C 162 160, 128 162, 122 150" />
            </g>
          ) : null}
        </motion.g>
      ) : null}

      {/* I'm Listening — slow ripples, like someone leaning in. */}
      {action === "listening"
        ? [0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx="120"
              cy="100"
              r="40"
              fill="none"
              stroke={C.blush}
              strokeWidth="1.5"
              initial={reduce ? false : { opacity: 0, scale: 1 }}
              animate={
                loop
                  ? { opacity: [0.55, 0], scale: [1, 2.1] }
                  : { opacity: 0.3 - i * 0.08, scale: 1.3 + i * 0.35 }
              }
              transition={
                loop ? { duration: 4.5, repeat: Infinity, delay: i * 1.5, ease: "easeOut" } : undefined
              }
              style={{ transformOrigin: "120px 100px" }}
            />
          ))
        : null}

      {/* The object itself, breathing gently. */}
      <motion.g
        animate={breathe}
        style={{ transformOrigin: "120px 100px", opacity: ended ? 0.75 : 1 }}
      >
        <circle cx="120" cy="100" r="70" fill={`url(#glow-${uid})`} />
        {object === "orb" ? <Orb uid={uid} /> : null}
        {object === "cloud" ? (
          <Cloud uid={uid} warm={state === "held" || action === "warmth"} busy={busy} loop={loop} />
        ) : null}
        {object === "star" ? <Star /> : null}
        {object === "heart" ? <Heart uid={uid} /> : null}
        {object === "moon" ? <Moon uid={uid} /> : null}
      </motion.g>

      {/* Stay Beside Me — a second light arrives beside it. */}
      {action === "stay" ? (
        <SecondLight cx={object === "star" ? 168 : 196} cy={object === "star" ? 74 : 92} loop={loop} reduce={reduce} uid={uid} />
      ) : null}

      {/* Gentle Space — farther off, smaller, but it stays. */}
      {action === "space" ? (
        <SecondLight cx={208} cy={36} r={4} loop={loop} reduce={reduce} uid={uid} faint />
      ) : null}
    </svg>
  );
}

function SecondLight({
  cx,
  cy,
  r = 7,
  loop,
  reduce,
  uid,
  faint = false,
}: {
  cx: number;
  cy: number;
  r?: number;
  loop: boolean;
  reduce: boolean;
  uid: string;
  faint?: boolean;
}) {
  return (
    <motion.g
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: faint ? 0.75 : 1, y: 0 }}
      transition={{ duration: 2.2, ease: "easeOut" }}
    >
      <circle cx={cx} cy={cy} r={r * 3.2} fill={`url(#warm-${uid})`} />
      <motion.circle
        cx={cx}
        cy={cy}
        r={r}
        fill={C.warm}
        animate={loop ? { opacity: [0.8, 1, 0.8] } : { opacity: 0.95 }}
        transition={loop ? { duration: 3.5, repeat: Infinity, ease: "easeInOut" } : undefined}
      />
    </motion.g>
  );
}

function Orb({ uid }: { uid: string }) {
  return (
    <>
      <circle cx="120" cy="100" r="30" fill={`url(#body-${uid})`} />
      <circle cx="111" cy="90" r="8" fill={C.cream} opacity="0.7" />
    </>
  );
}

function Cloud({ uid, warm, busy, loop }: { uid: string; warm: boolean; busy: boolean; loop: boolean }) {
  const motes = busy ? 7 : 4;
  return (
    <g>
      {/* A warm light inside — it grows when someone is beside it. */}
      <circle cx="120" cy="104" r={warm ? 30 : 18} fill={`url(#warm-${uid})`} style={{ transition: "r 2s" }} />
      <g fill={`url(#body-${uid})`} opacity="0.92">
        <circle cx="92" cy="110" r="26" />
        <circle cx="120" cy="92" r="34" />
        <circle cx="152" cy="106" r="28" />
        <rect x="76" y="106" width="96" height="30" rx="15" />
      </g>
      {Array.from({ length: motes }).map((_, i) => (
        <motion.circle
          key={i}
          cx={88 + i * (70 / motes)}
          cy={146}
          r={1.8}
          fill={C.cream}
          animate={loop ? { cy: [146, 160, 146], opacity: [0.2, 0.7, 0.2] } : { opacity: 0.4 }}
          transition={
            loop ? { duration: busy ? 3 + (i % 3) : 6 + (i % 3), repeat: Infinity, delay: i * 0.6 } : undefined
          }
        />
      ))}
    </g>
  );
}

function Star() {
  return (
    <g>
      <path
        d="M120 66 C 124 92, 128 96, 154 100 C 128 104, 124 108, 120 134 C 116 108, 112 104, 86 100 C 112 96, 116 92, 120 66 Z"
        fill={C.cream}
      />
      <circle cx="120" cy="100" r="6" fill="#fff" />
    </g>
  );
}

function Heart({ uid }: { uid: string }) {
  return (
    <path
      d="M120 140 C 82 114, 76 92, 86 78 C 96 64, 114 68, 120 82 C 126 68, 144 64, 154 78 C 164 92, 158 114, 120 140 Z"
      fill={`url(#body-${uid})`}
      fillOpacity="0.7"
      stroke={C.cream}
      strokeOpacity="0.8"
      strokeWidth="1.5"
    />
  );
}

function Moon({ uid }: { uid: string }) {
  return (
    <g>
      <circle cx="116" cy="96" r="36" fill={C.cream} mask={`url(#crescent-${uid})`} />
      {/* A soft cloud half over it. */}
      <g fill={C.mauve} opacity="0.55" filter={`url(#soft-${uid})`}>
        <ellipse cx="128" cy="128" rx="44" ry="13" />
        <ellipse cx="100" cy="122" rx="22" ry="10" />
      </g>
    </g>
  );
}
