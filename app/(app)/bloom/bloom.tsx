"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { bloomConfig } from "./bloom-config";
import { BloomScene } from "./flowers";

const lines = bloomConfig.openingLines;
const song = bloomConfig.song;

// Build the hidden YouTube embed. autoplay works because we mount the iframe
// right after a tap (a user gesture). We DON'T loop, so it keeps playing
// forward from the chorus rather than restarting at the intro.
function ytSrc() {
  const p = new URLSearchParams({
    autoplay: "1",
    start: String(song.startSeconds),
    enablejsapi: "1",
    playsinline: "1",
    controls: "0",
    rel: "0",
    modestbranding: "1",
  });
  return `https://www.youtube.com/embed/${song.youtubeId}?${p.toString()}`;
}

export function Bloom() {
  const reduce = useReducedMotion();
  // Which opening line we've revealed up to (index into `lines`).
  const [step, setStep] = useState(0);
  // "opening" = showing words · "bloom" = flowers are out.
  const [phase, setPhase] = useState<"opening" | "bloom">("opening");
  const [muted, setMuted] = useState(false);

  const ytRef = useRef<HTMLIFrameElement>(null);

  const atLastLine = step >= lines.length - 1;
  const hasSong = song.youtubeId.length > 0;

  // Talk to the YouTube iframe (enablejsapi=1) without loading the JS API.
  function ytCommand(func: "playVideo" | "mute" | "unMute") {
    ytRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*",
    );
  }

  function advance() {
    if (phase !== "opening") return;
    if (atLastLine) setPhase("bloom");
    else setStep((s) => s + 1);
  }

  function replay() {
    setStep(0);
    setPhase("opening");
    setMuted(false);
  }

  function toggleSound() {
    // Also nudge play in case autoplay was blocked by the browser.
    ytCommand("playVideo");
    if (muted) ytCommand("unMute");
    else ytCommand("mute");
    setMuted((m) => !m);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ground text-ink">
      {hasSong && phase === "bloom" ? (
        <iframe
          ref={ytRef}
          title={song.title}
          src={ytSrc()}
          allow="autoplay; encrypted-media"
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
          aria-hidden
        />
      ) : null}

      {/* soft warm glow that brightens a touch when the flowers appear */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: phase === "bloom" ? 1 : 0 }}
        transition={{ duration: 1.2 }}
        style={{
          background:
            "radial-gradient(120% 90% at 50% 100%, var(--blush) 0%, transparent 60%)",
        }}
      />

      <AnimatePresence mode="wait">
        {phase === "opening" ? (
          <motion.button
            key="opening"
            type="button"
            onClick={advance}
            className="absolute inset-0 flex w-full flex-col items-center justify-center px-8 text-center"
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
          >
            <div className="flex min-h-[7rem] items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={step}
                  className="max-w-md font-display text-2xl font-medium leading-snug text-ink whitespace-pre-line text-balance sm:text-3xl"
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -14 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                >
                  {lines[step]}
                </motion.p>
              </AnimatePresence>
            </div>

            <motion.span
              className="mt-8 font-mono text-xs tracking-wide text-ink-faint"
              animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            >
              {atLastLine ? bloomConfig.openLabel : bloomConfig.tapHint}
            </motion.span>
          </motion.button>
        ) : (
          <motion.div
            key="bloom"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <BloomScene className="absolute inset-0" />

            {/* the message, floating above the flowers */}
            <motion.div
              className="absolute inset-x-0 top-[16%] flex flex-col items-center px-8 text-center"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 3.9, duration: 0.9 }}
            >
              <h1 className="font-display text-4xl font-medium text-ink text-balance sm:text-5xl">
                {bloomConfig.finalMessage}
              </h1>
              <p className="mt-3 max-w-xs font-hand text-2xl text-accent-ink text-balance">
                {bloomConfig.finalSub}
              </p>
            </motion.div>

            {/* mute toggle, only when there's a song */}
            {hasSong ? (
              <motion.button
                type="button"
                onClick={toggleSound}
                aria-label={muted ? "Nyalakan lagu" : "Matikan lagu"}
                className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-paper/70 text-lg backdrop-blur transition hover:border-accent-ink/40"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduce ? 0 : 1, duration: 0.6 }}
              >
                {muted ? "🔇" : "🎵"}
              </motion.button>
            ) : null}

            {/* gentle exits */}
            <motion.div
              className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-3"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 4.6, duration: 0.6 }}
            >
              <button
                type="button"
                onClick={replay}
                className="rounded-full border border-rule bg-paper/70 px-4 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
              >
                {bloomConfig.replayLabel}
              </button>
              <Link
                href="/"
                className="rounded-full border border-rule bg-paper/70 px-4 py-2 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
              >
                {bloomConfig.backLabel}
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
