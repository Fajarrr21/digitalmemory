"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { openDirectLetter } from "./actions";
import { spotifyEmbedUrl } from "@/lib/spotify";

export type InboxLetter = {
  id: string;
  title: string | null;
  body: string;
  status: "sealed" | "opened";
  dateLabel: string;
  songTrackId: string | null;
  songTitle: string | null;
  /** Locked until the previous letter in its sequence is opened. */
  locked: boolean;
  /** 1-based position within a sequence, or null for a standalone letter. */
  seqPosition: number | null;
  seqTotal: number | null;
};

function seqLabel(letter: InboxLetter): string | null {
  if (!letter.seqPosition || !letter.seqTotal) return null;
  return `Surat ke-${letter.seqPosition} dari ${letter.seqTotal}`;
}

export function DirectLettersInbox({
  letters,
  senderName,
}: {
  letters: InboxLetter[];
  senderName: string;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {letters.map((letter) => (
        <li key={letter.id}>
          <InboxItem letter={letter} senderName={senderName} />
        </li>
      ))}
    </ul>
  );
}

function InboxItem({ letter, senderName }: { letter: InboxLetter; senderName: string }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(letter.status === "opened");
  const label = seqLabel(letter);

  function handleOpen() {
    if (open) return;
    setOpen(true);
    if (letter.status === "sealed") void openDirectLetter(letter.id);
  }

  // A later letter in a sequence, still waiting on the one before it.
  if (letter.locked) {
    return (
      <div className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-rule-soft bg-ground/40 p-4 opacity-70">
        <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-rule-soft text-ink-faint">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <span className="flex flex-col">
          <span className="font-hand text-xl text-ink-soft">
            {label ?? "Surat berikutnya"}
          </span>
          <span className="font-mono text-[11px] text-ink-faint">
            Buka surat sebelumnya dulu ya ♡
          </span>
        </span>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!open ? (
        <motion.button
          key="sealed"
          type="button"
          onClick={handleOpen}
          aria-label={`Buka surat dari ${senderName}`}
          className="group flex w-full items-center gap-4 rounded-2xl border border-rule bg-paper-2 p-4 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 focus-visible:outline-none"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <MiniEnvelope />
          <span className="flex flex-col">
            <span className="font-hand text-xl text-accent-ink">
              {label ?? `Surat dari ${senderName}`}
            </span>
            <span className="font-mono text-[11px] text-ink-faint">
              {letter.dateLabel} · ketuk untuk membuka
            </span>
            {letter.songTrackId ? (
              <span className="mt-0.5 font-mono text-[11px] text-accent-ink">
                ♪ {letter.songTitle ? `ada lagu — ${letter.songTitle}` : "ada lagu untukmu"}
              </span>
            ) : null}
          </span>
        </motion.button>
      ) : (
        <motion.article
          key="opened"
          className="rounded-2xl border border-rule bg-paper p-6 shadow-[var(--shadow-soft)] sm:p-7"
          initial={reduce ? false : { opacity: 0, y: 12, scaleY: 0.94 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "top center" }}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
              {label ? `${label} · dari ${senderName}` : `dari ${senderName}`}
            </span>
            <span className="font-mono text-[11px] text-ink-faint">{letter.dateLabel}</span>
          </div>

          {letter.title ? (
            <h3 className="mt-3 font-display text-xl font-medium text-ink text-balance">
              {letter.title}
            </h3>
          ) : null}

          <motion.p
            className="mt-4 whitespace-pre-line font-display text-[1.08rem] leading-[1.8] text-ink"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 0.3, duration: 0.7 }}
          >
            {letter.body}
          </motion.p>

          {letter.songTrackId ? (
            <motion.div
              className="mt-5"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.45, duration: 0.7 }}
            >
              <iframe
                title={letter.songTitle ?? "Lagu untukmu"}
                src={spotifyEmbedUrl(letter.songTrackId)}
                width="100%"
                height={152}
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                style={{ border: 0, borderRadius: 12 }}
              />
            </motion.div>
          ) : null}

          <p className="mt-6 text-right font-hand text-lg text-accent-ink">— untukmu ♡</p>
        </motion.article>
      )}
    </AnimatePresence>
  );
}

/** Compact paper envelope with a wax-heart seal, for inbox rows. */
function MiniEnvelope() {
  return (
    <div className="relative h-12 w-16 shrink-0">
      <div className="absolute inset-0 rounded-md border border-rule bg-paper shadow-[var(--shadow-soft)]" />
      <div
        className="absolute inset-x-0 top-0 h-1/2 origin-top"
        style={{
          background: "var(--blush)",
          clipPath: "polygon(0 0, 100% 0, 50% 92%)",
          borderTopLeftRadius: "0.375rem",
          borderTopRightRadius: "0.375rem",
          opacity: 0.9,
        }}
      />
      <div className="absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent shadow-[var(--shadow-lift)]">
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-[#4a2b30]" fill="currentColor" aria-hidden="true">
          <path d="M12 20s-6.5-4.3-9-8.2C1.4 9 2.5 5.7 5.7 5.2 7.8 4.9 9.4 6 12 8.6c2.6-2.6 4.2-3.7 6.3-3.4 3.2.5 4.3 3.8 2.7 6.6C18.5 15.7 12 20 12 20Z" />
        </svg>
      </div>
    </div>
  );
}
