"use client";

import { motion, useReducedMotion } from "motion/react";
import { UI } from "./journey-config";

// Bahasa visual bersama /journey — dipakai bab-bab lama dan cerita awal kita.

// Palet terang di atas langit malam sendiri — warna eksplisit, bukan token tema.
export const INK = "text-[#f4ead9]";
export const SOFT = "text-[#cdbfae]";
export const FAINT = "text-[#9a8b7c]";
export const ACCENT = "text-[#eda9b2]";
export const WARM = "text-[#f2c98a]";
export const BTN =
  "rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] px-6 py-2.5 font-display text-[#f4ead9] backdrop-blur transition hover:border-[#eda9b2]/50 hover:text-[#eda9b2]";
export const SMALL_BTN =
  "rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] px-4 py-2 text-sm text-[#cdbfae] backdrop-blur transition hover:border-[#eda9b2]/40 hover:text-[#f4ead9]";
export const CARD = "rounded-2xl border border-[#f4ead9]/10 bg-[#f4ead9]/[0.04] backdrop-blur-sm";

export function stopPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

export function TapHint({ label }: { label: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={`mt-10 block font-mono text-[11px] tracking-[0.2em] ${FAINT}`}
      animate={reduce ? undefined : { opacity: [0.35, 1, 0.35] }}
      transition={{ duration: 2.4, repeat: Infinity }}
    >
      {label}
    </motion.span>
  );
}

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.9, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function NextButton({ onNext, label = UI.next }: { onNext: () => void; label?: string }) {
  return (
    <Reveal delay={0.3} className="mt-12">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className={`text-[15px] ${BTN}`}
      >
        {label}
      </button>
    </Reveal>
  );
}
