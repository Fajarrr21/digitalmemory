"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CATEGORIES } from "@/lib/dice/config";

/**
 * A rounded 3D die with hearts for pips, pure CSS transforms. Give it a
 * `face` + a `rollKey`: a new key spins it (always forwards, a few full turns)
 * and settles on that face; `spinning` keeps it tumbling while the server
 * decides. Reduced motion: no spin, it just shows the face.
 */

const SIZE = 136;
const HALF = SIZE / 2;

// cube rotation that brings each face to the front
const TARGET: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};
// where each face sits on the cube
const PLACE: Record<number, string> = {
  1: `translateZ(${HALF}px)`,
  2: `rotateX(90deg) translateZ(${HALF}px)`,
  3: `rotateY(90deg) translateZ(${HALF}px)`,
  4: `rotateY(-90deg) translateZ(${HALF}px)`,
  5: `rotateX(-90deg) translateZ(${HALF}px)`,
  6: `rotateY(180deg) translateZ(${HALF}px)`,
};
// heart positions on a 3×3 grid (0..8), like real pips
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function DiceCube({
  face,
  rollKey,
  spinning,
  onSettled,
}: {
  face: number | null;
  rollKey: string | null;
  spinning: boolean;
  onSettled?: () => void;
}) {
  const reduce = useReducedMotion();
  const settledFor = useRef(rollKey);
  // Rotation is derived during render (no effect): a spin adds turns, a new
  // face lands at least two full turns further on, always forwards.
  const [st, setSt] = useState({ rot: TARGET[face ?? 1], key: rollKey, face, spinning });
  if (spinning !== st.spinning) {
    setSt((s) => ({ ...s, spinning, rot: spinning ? { x: s.rot.x + 720, y: s.rot.y + 540 } : s.rot }));
  } else if (!spinning && rollKey && face != null && (rollKey !== st.key || face !== st.face)) {
    const ahead = (from: number, to: number) => from + 720 + ((((to - from - 720) % 360) + 360) % 360);
    const t = TARGET[face];
    setSt((s) => ({ ...s, key: rollKey, face, rot: { x: ahead(s.rot.x, t.x), y: ahead(s.rot.y, t.y) } }));
  }
  const rot = st.rot;

  // Reduced motion: nothing animates, so "landed" is immediate.
  useEffect(() => {
    if (!reduce || !rollKey || face == null || spinning || settledFor.current === rollKey) return;
    settledFor.current = rollKey;
    onSettled?.();
  }, [reduce, rollKey, face, spinning, onSettled]);

  return (
    <div className="grid place-items-center py-6" style={{ perspective: 700 }}>
      <motion.div
        aria-label={face ? `Dadu menunjukkan ${face}` : "Dadu"}
        role="img"
        className="relative"
        style={{ width: SIZE, height: SIZE, transformStyle: "preserve-3d" }}
        initial={false}
        animate={reduce ? { rotateX: TARGET[face ?? 1].x, rotateY: TARGET[face ?? 1].y } : { rotateX: rot.x, rotateY: rot.y }}
        transition={spinning ? { duration: 1.6, ease: "linear" } : { type: "spring", stiffness: 38, damping: 13, mass: 1.1 }}
        onAnimationComplete={() => {
          if (reduce || spinning || !rollKey || settledFor.current === rollKey) return;
          settledFor.current = rollKey;
          onSettled?.();
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const cat = CATEGORIES[n - 1];
          return (
            <div
              key={n}
              className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-4 shadow-[inset_0_0_18px_rgba(0,0,0,0.06)]"
              style={{
                transform: PLACE[n],
                borderRadius: "22%",
                background: `radial-gradient(circle at 30% 25%, #fffdf9, ${cat.tint})`,
                border: "1px solid rgba(121,85,72,0.15)",
                backfaceVisibility: "hidden",
              }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  className="grid place-items-center text-xl leading-none"
                  style={{ color: cat.ink, opacity: PIPS[n].includes(i) ? 1 : 0 }}
                >
                  ♥
                </span>
              ))}
            </div>
          );
        })}
      </motion.div>
      <div aria-hidden className="mt-4 h-3 w-24 rounded-full bg-ink/10 blur-[6px]" />
    </div>
  );
}
