"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { tierFor } from "@/app/(app)/flame/flame-config";

/**
 * The living flame. Day 1 is a small spark; Day 100 fills the room. Layers:
 * a soft glow, three teardrop flame bodies (outer/mid/core) flickering at
 * different rhythms, rising particles, and gold sparkles for the top tiers.
 * `quiet` renders the dim, grey "the flame went quiet" state.
 */
export function Flame({
  streak,
  quiet = false,
  size = 180,
}: {
  streak: number;
  quiet?: boolean;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const tier = tierFor(Math.max(1, streak));
  const s = quiet ? 0.6 : tier.scale;
  const w = size * s;
  const h = size * 1.15 * s;
  const animate = !reduce && !quiet;

  // Deterministic-per-mount particle placement (no hydration surprises).
  const particles = useMemo(
    () =>
      Array.from({ length: quiet ? 0 : tier.particles }, (_, i) => ({
        left: 32 + ((i * 37) % 36), // 32%..68%
        delay: (i * 0.9) % 3,
        duration: 2.6 + ((i * 0.7) % 1.8),
        size: 3 + ((i * 2) % 4),
      })),
    [tier.particles, quiet],
  );

  const colors = quiet
    ? { core: "#d9d2c7", mid: "#b8afa2", outer: "#8f877b", glow: "#b8afa2" }
    : tier;

  return (
    <div
      className="relative mx-auto"
      style={{ width: w, height: h }}
      role="img"
      aria-label={quiet ? "The flame is quiet" : `${tier.name} — day ${streak}`}
    >
      {/* glow */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(closest-side, ${colors.glow}${quiet ? "22" : "55"} 0%, transparent 70%)`,
          filter: "blur(8px)",
        }}
        animate={animate ? { opacity: [0.7, 1, 0.7], scale: [1, 1.06, 1] } : undefined}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />

      <FlameBody color={colors.outer} side={w * 0.52} bottom={h * 0.06} animate={animate} duration={2.1} sway={7} />
      <FlameBody color={colors.mid} side={w * 0.36} bottom={h * 0.09} animate={animate} duration={1.6} sway={-6} />
      <FlameBody color={colors.core} side={w * 0.2} bottom={h * 0.12} animate={animate} duration={1.25} sway={4} />

      {/* base ember */}
      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full"
        style={{ background: `${colors.outer}66`, filter: "blur(2px)" }}
      />

      {/* rising particles */}
      {animate &&
        particles.map((p, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute bottom-6 rounded-full"
            style={{ left: `${p.left}%`, width: p.size, height: p.size, background: colors.mid }}
            animate={{ y: [0, -h * 0.7], opacity: [0, 0.9, 0], x: [0, i % 2 === 0 ? 8 : -8] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeOut" }}
          />
        ))}

      {/* sparkles for radiant/eternal */}
      {animate && tier.sparkle
        ? [18, 74, 46].map((left, i) => (
            <motion.span
              key={left}
              aria-hidden
              className="absolute text-sm"
              style={{ left: `${left}%`, top: `${14 + i * 22}%` }}
              animate={{ opacity: [0, 1, 0], scale: [0.6, 1.15, 0.6], rotate: [0, 20, 0] }}
              transition={{ duration: 2.4, delay: i * 0.8, repeat: Infinity }}
            >
              ✨
            </motion.span>
          ))
        : null}
    </div>
  );
}

/**
 * One teardrop layer: a square with one sharp corner (top-right), rotated
 * -45° so the point faces up. Sway/scale animate *around* that base rotation.
 */
function FlameBody({
  color,
  side,
  bottom,
  animate,
  duration,
  sway,
}: {
  color: string;
  side: number;
  bottom: number;
  animate: boolean;
  duration: number;
  sway: number;
}) {
  return (
    <motion.div
      aria-hidden
      className="absolute left-1/2"
      style={{
        width: side,
        height: side,
        background: color,
        borderRadius: "50% 0 50% 50%",
        bottom,
        x: "-50%",
        rotate: -45,
      }}
      animate={
        animate
          ? {
              rotate: [-45, -45 + sway * 0.5, -45 - sway * 0.35, -45],
              scale: [1, 1.06, 0.96, 1],
            }
          : undefined
      }
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
