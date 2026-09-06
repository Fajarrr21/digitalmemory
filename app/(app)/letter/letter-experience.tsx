"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { openLetter } from "./actions";

const CATEGORY_LABEL: Record<string, string> = {
  good_morning: "Selamat pagi",
  good_night: "Selamat malam",
  romantic: "Untukmu",
  comfort: "Sebuah pelukan",
  appreciation: "Terima kasih",
  missing_you: "Aku kangen",
  celebration: "Selamat!",
  proud_of_you: "Aku bangga",
  sad_day: "Hari yang berat",
  motivation: "Buat harimu",
  random_love: "Sekadar cinta",
};

type Props = {
  letterId: string;
  category: string;
  title: string | null;
  body: string;
  status: "sealed" | "opened";
  isRecipient: boolean;
  dateLabel: string;
};

export function LetterExperience(props: Props) {
  const { letterId, category, title, body, status, isRecipient, dateLabel } = props;
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(status === "opened" || !isRecipient);

  function handleOpen() {
    if (open) return;
    setOpen(true);
    if (isRecipient && status === "sealed") {
      // Fire-and-forget; persistence isn't needed for the reveal to feel right.
      void openLetter(letterId);
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.button
            key="envelope"
            type="button"
            onClick={handleOpen}
            aria-label="Buka surat hari ini"
            className="group flex flex-col items-center gap-6 focus-visible:outline-none"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Envelope />
            <span className="font-hand text-2xl text-accent-ink transition group-hover:-translate-y-0.5">
              ketuk untuk membuka
            </span>
          </motion.button>
        ) : (
          <motion.article
            key="letter"
            className="w-full max-w-lg rounded-2xl border border-rule bg-paper p-7 shadow-[var(--shadow-soft)] sm:p-9"
            initial={reduce ? false : { opacity: 0, y: 20, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top center" }}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
                {CATEGORY_LABEL[category] ?? "Surat hari ini"}
              </span>
              <span className="font-mono text-[11px] text-ink-faint">{dateLabel}</span>
            </div>

            {title ? (
              <h1 className="mt-4 font-display text-2xl font-medium text-ink text-balance">
                {title}
              </h1>
            ) : null}

            <motion.p
              className="mt-5 whitespace-pre-line font-display text-[1.15rem] leading-[1.85] text-ink"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.35, duration: 0.8 }}
            >
              {body}
            </motion.p>

            <p className="mt-7 text-right font-hand text-xl text-accent-ink">— untukmu ♡</p>

            {!isRecipient ? (
              <p className="mt-6 border-t border-rule-soft pt-4 text-center text-xs text-ink-faint">
                Ini surat yang dia terima hari ini. Kamu yang menulisnya. ♡
              </p>
            ) : null}
          </motion.article>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A small paper envelope with a wax-heart seal. */
function Envelope() {
  return (
    <div className="relative h-44 w-64 transition-transform duration-300 group-hover:-translate-y-1 sm:h-48 sm:w-72">
      <div className="absolute inset-0 rounded-lg border border-rule bg-paper-2 shadow-[var(--shadow-soft)]" />
      {/* flap */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 origin-top"
        style={{
          background: "var(--blush)",
          clipPath: "polygon(0 0, 100% 0, 50% 92%)",
          borderTopLeftRadius: "0.5rem",
          borderTopRightRadius: "0.5rem",
          opacity: 0.9,
        }}
      />
      {/* wax heart seal */}
      <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent shadow-[var(--shadow-lift)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#4a2b30]" fill="currentColor" aria-hidden="true">
          <path d="M12 20s-6.5-4.3-9-8.2C1.4 9 2.5 5.7 5.7 5.2 7.8 4.9 9.4 6 12 8.6c2.6-2.6 4.2-3.7 6.3-3.4 3.2.5 4.3 3.8 2.7 6.6C18.5 15.7 12 20 12 20Z" />
        </svg>
      </div>
    </div>
  );
}
