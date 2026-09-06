"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { FEELINGS, type Feeling } from "./comfort-config";

export function ComfortRoom() {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<Feeling | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-ink-soft">Lagi ngerasa apa sekarang? Nggak apa-apa, apa pun itu.</p>

      <div className="flex flex-wrap gap-2.5">
        {FEELINGS.map((f) => {
          const active = selected?.key === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setSelected(f)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-4 py-2 text-[15px] transition",
                active
                  ? "border-accent bg-accent text-[#4a2b30]"
                  : "border-rule text-ink-soft hover:border-accent-ink/40 hover:text-ink",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div
            key={selected.key}
            className="rounded-2xl border border-accent/40 bg-blush/40 px-6 py-7"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.45 }}
          >
            <p className="font-display text-[1.25rem] leading-relaxed text-ink text-balance">
              {selected.response}
            </p>
            {selected.suggest ? (
              <Link
                href={selected.suggest.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline"
              >
                {selected.suggest.label} →
              </Link>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
