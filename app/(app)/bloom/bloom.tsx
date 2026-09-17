"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { bloomConfig } from "./bloom-config";
import { BloomScene } from "./flowers";

const lines = bloomConfig.openingLines;
const song = bloomConfig.song;
const letter = bloomConfig.letter;
const greeting = letter.slice(0, 2); // shown over the bloom
const body = letter.slice(2); // revealed as she scrolls

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

            {/* mute toggle, only when there's a song — stays put while reading */}
            {hasSong ? (
              <motion.button
                type="button"
                onClick={toggleSound}
                aria-label={muted ? "Nyalakan lagu" : "Matikan lagu"}
                className="fixed right-5 top-5 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-paper/70 text-lg backdrop-blur transition hover:border-accent-ink/40"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduce ? 0 : 1, duration: 0.6 }}
              >
                {muted ? "🔇" : "🎵"}
              </motion.button>
            ) : null}

            {/* the letter — flowers stay behind; scroll down to read, each
                paragraph rises in gently as it comes into view */}
            <motion.div
              className="absolute inset-0 z-20 overflow-y-auto overflow-x-hidden"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 3.9, duration: 1 }}
            >
              {/* hero: greeting over the bloom, with a scroll cue */}
              <div className="relative flex min-h-[100dvh] flex-col items-center px-6 text-center">
                <div className="pt-[13vh]">
                  <h1 className="font-display text-4xl font-medium text-ink text-balance sm:text-5xl">
                    {greeting[0]?.text}
                  </h1>
                  {greeting[1] ? (
                    <p className="mt-3 font-hand text-2xl text-accent-ink text-balance">
                      {greeting[1].text}
                    </p>
                  ) : null}
                </div>
                <motion.div
                  className="mt-auto flex flex-col items-center gap-1 pb-12 text-ink-faint"
                  animate={reduce ? undefined : { y: [0, 7, 0], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span className="font-mono text-[11px] tracking-wide">
                    {bloomConfig.scrollHint}
                  </span>
                  <span aria-hidden className="text-lg leading-none">
                    ⌄
                  </span>
                </motion.div>
              </div>

              {/* body: the letter itself, over a scrim for readability */}
              <div className="relative bg-gradient-to-b from-transparent via-ground/85 to-ground pt-4 pb-28">
                <div className="mx-auto flex max-w-xl flex-col items-center gap-7 px-6 text-center">
                  {body.map((p, i) => {
                    const cls =
                      p.tone === "title"
                        ? "font-display text-3xl font-medium text-ink text-balance sm:text-4xl"
                        : p.tone === "accent"
                          ? "font-hand text-2xl text-accent-ink text-balance sm:text-[1.7rem]"
                          : "max-w-prose text-[15px] leading-relaxed text-ink-soft text-pretty sm:text-base";
                    return (
                      <motion.p
                        key={i}
                        className={cls}
                        initial={reduce ? false : { opacity: 0, y: 22 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "0px 0px -12% 0px" }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      >
                        {p.text}
                      </motion.p>
                    );
                  })}

                  {/* gentle exits at the end of the letter */}
                  <motion.div
                    className="mt-6 flex items-center justify-center gap-3"
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "0px 0px -8% 0px" }}
                    transition={{ duration: 0.7 }}
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
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
