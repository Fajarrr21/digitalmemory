"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * ❤️ 😂 😭 — a tap floats up over the video for a moment and is gone. They are
 * never a notification and never wait to be read; the point is that the other
 * person sees it happen *while* it's happening.
 */

export type FloatingReaction = {
  id: string;
  emoji: string;
  /** 0–1 across the width, so two taps at once don't stack. */
  x: number;
  mine: boolean;
};

export function ReactionLayer({ items }: { items: FloatingReaction[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {items.map((r) => (
          <motion.span
            key={r.id}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={
              reduce
                ? { opacity: 1, y: -20, scale: 1 }
                : { opacity: [0, 1, 1, 0], y: [-8, -70, -140, -200], scale: [0.6, 1.15, 1, 0.9] }
            }
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.4 : 2.4, ease: "easeOut" }}
            style={{ left: `${Math.round(r.x * 100)}%` }}
            className="absolute bottom-10 text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:text-4xl"
          >
            {r.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
