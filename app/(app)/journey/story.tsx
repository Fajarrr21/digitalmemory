"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { UI } from "./journey-config";
import {
  REEL,
  RIGHT,
  STORY_ACTS,
  STORY_MOMENTS,
  STORY_RECAP,
  type Bubble,
  type StoryAct,
  type StoryMoment,
} from "./story-config";
import {
  ACCENT,
  BTN,
  CARD,
  FAINT,
  INK,
  NextButton,
  Reveal,
  SMALL_BTN,
  SOFT,
  TapHint,
  WARM,
  stopPropagation,
} from "./journey-ui";

// ⏪ Cerita awal kita — Instagram → Instagram kedua → WhatsApp → first call.
// Bukan chat viewer: setiap momen adalah satu scene kecil (narasi → potongan
// chat asli → narasi), dengan bahasa visual yang sama seperti bab-bab lain.

export type StoryMedia = Record<string, string>;

const actOf = (id: StoryMoment["act"]) => STORY_ACTS.find((a) => a.id === id)!;

// ── Bagian (Instagram / Instagram kedua / WhatsApp) ────────────────────────────
export function StoryActScene({ act, onNext }: { act: StoryAct; onNext: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const done = n >= act.lines.length;
  return (
    <div
      onClick={() => !done && setN((v) => v + 1)}
      className={`flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 pt-24 pb-40 text-center ${
        done ? "" : "cursor-pointer"
      }`}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96, filter: "blur(6px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <p className={`font-mono text-[11px] uppercase tracking-[0.32em] ${FAINT}`}>
          {act.emoji} {act.part}
        </p>
        <h2 className={`mt-4 font-display text-4xl sm:text-5xl ${INK}`}>{act.title}</h2>
        <p className={`mt-2 font-display text-lg italic ${SOFT}`}>— {act.sub}</p>
        <p className={`mt-4 font-mono text-[12px] tracking-[0.12em] ${FAINT}`}>
          {act.id === "wa" ? act.handle : `@${act.handle}`}
        </p>
        <p className={`mt-5 font-hand text-2xl ${ACCENT}`}>{act.tagline}</p>
      </motion.div>

      <div className="mt-12 flex max-w-md flex-col items-center gap-5">
        {act.lines.slice(0, n).map((line, i) => (
          <Reveal key={i}>
            <p className={`whitespace-pre-line text-balance font-display text-xl leading-relaxed ${INK}`}>
              {line}
            </p>
          </Reveal>
        ))}
      </div>

      {done ? <NextButton onNext={onNext} /> : <TapHint label={UI.tapHint} />}
    </div>
  );
}

// ── satu bubble ────────────────────────────────────────────────────────────────
function BubbleView({ b, act, delay }: { b: Bubble; act: StoryAct; delay: number }) {
  const reduce = useReducedMotion();
  const anim = {
    initial: reduce ? false : ({ opacity: 0, y: 8, scale: 0.97 } as const),
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { delay: reduce ? 0 : delay, duration: 0.35, ease: "easeOut" as const },
  };

  if ("time" in b) {
    return (
      <motion.p {...anim} className={`my-2 text-center font-mono text-[10px] tracking-[0.18em] ${FAINT}`}>
        {b.time}
      </motion.p>
    );
  }
  if ("gap" in b) {
    return (
      <motion.p {...anim} aria-label="potongan lain" className={`my-3 text-center tracking-[0.5em] ${FAINT}`}>
        · · ·
      </motion.p>
    );
  }

  const right = b.from === RIGHT;
  const big = "text" in b && b.big;
  const bubbleStyle = right && !big ? { background: act.bubble } : undefined;
  const shape = right
    ? "bg-[#f4ead9]/10 text-[#f4ead9]"
    : "bg-[#f4ead9]/[0.09] text-[#f4ead9] border border-[#f4ead9]/10";

  return (
    <motion.div {...anim} className={`flex flex-col ${right ? "items-end" : "items-start"}`}>
      {b.quote ? (
        <p
          className={`mb-0.5 max-w-[80%] truncate rounded-2xl border-l-2 border-[#f4ead9]/25 bg-[#f4ead9]/[0.04] px-3 py-1.5 text-[12px] ${FAINT}`}
        >
          {b.quote}
        </p>
      ) : null}
      {"text" in b ? (
        big ? (
          <p className="px-1 text-3xl leading-tight">{b.text}</p>
        ) : (
          <p
            style={bubbleStyle}
            className={`max-w-[85%] whitespace-pre-line break-words rounded-[20px] px-4 py-2 text-left text-[15px] leading-snug ${shape}`}
          >
            {b.text}
          </p>
        )
      ) : (
        <Attachment b={b} style={bubbleStyle} shape={shape} />
      )}
    </motion.div>
  );
}

function Attachment({
  b,
  style,
  shape,
}: {
  b: Extract<Bubble, { attach: string }>;
  style?: React.CSSProperties;
  shape: string;
}) {
  switch (b.attach) {
    case "voice":
      return (
        <p style={style} className={`flex items-center gap-3 rounded-[20px] px-4 py-2.5 ${shape}`}>
          <span aria-hidden>▶</span>
          <span aria-hidden className="flex items-center gap-[3px]">
            {[3, 6, 9, 5, 11, 7, 12, 6, 9, 4, 10, 6, 8, 3, 7, 5].map((h, i) => (
              <span key={i} className="w-[2px] rounded-full bg-current opacity-80" style={{ height: h + 2 }} />
            ))}
          </span>
          <span className="font-mono text-[11px] opacity-80">{b.label}</span>
          <span className="sr-only">voice note</span>
        </p>
      );
    case "contact":
      // Nomornya sengaja tidak pernah ditampilkan.
      return (
        <div className={`w-56 rounded-2xl px-4 py-3 text-left ${shape}`}>
          <p className="font-display text-[15px]">📞 {b.label}</p>
          <p aria-hidden className={`mt-1 font-mono text-[12px] tracking-[0.2em] ${FAINT}`}>
            •••• •••• ••••
          </p>
          <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.2em] ${ACCENT}`}>Pesan WhatsApp →</p>
        </div>
      );
    case "link":
      return (
        <p style={style} className={`rounded-[20px] px-4 py-2 text-[15px] underline underline-offset-2 ${shape}`}>
          {b.label}
        </p>
      );
    case "sticker":
    case "photo":
    case "story":
      return (
        <p
          className={`max-w-[80%] rounded-2xl border border-dashed border-[#f4ead9]/20 px-4 py-3 text-left text-[13px] italic ${SOFT}`}
        >
          {b.attach === "story" ? "↪ " : ""}
          {b.label}
        </p>
      );
  }
}

/** Potongan chat asli, muncul satu per satu seperti sedang diketik. */
function ChatThread({ chat, act }: { chat: Bubble[]; act: StoryAct }) {
  // Jeda makin rapat kalau chatnya panjang, supaya nggak lama nunggu.
  const step = chat.length > 12 ? 0.22 : 0.38;
  return (
    <div
      onClick={stopPropagation}
      className={`mt-10 w-full max-w-sm overflow-hidden text-left ${CARD} bg-[#0b0c12]/40`}
    >
      <div className="flex items-center gap-3 border-b border-[#f4ead9]/10 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f4ead9]/10 text-[11px]">
          {act.id === "wa" ? "GD" : act.emoji}
        </span>
        <span className={`font-display text-[14px] ${INK}`}>{act.handle}</span>
        <span className={`ml-auto font-mono text-[9px] uppercase tracking-[0.2em] ${FAINT}`}>{act.title}</span>
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-4">
        {chat.map((b, i) => (
          <BubbleView key={i} b={b} act={act} delay={0.2 + i * step} />
        ))}
      </div>
    </div>
  );
}

/** Foto sebagai visual utama — polaroid yang sedikit miring. */
function Polaroid({ m, src }: { m: StoryMoment; src: string | undefined }) {
  const reduce = useReducedMotion();
  const photo = m.photo!;
  return (
    <motion.figure
      onClick={stopPropagation}
      className="mt-10 w-full max-w-xs rounded-sm bg-[#f4ead9] p-3 pb-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
      initial={reduce ? false : { opacity: 0, y: 24, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: -2 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={photo.alt} className="w-full rounded-[2px] bg-[#1b1a22] object-contain" />
      ) : (
        // Belum di-upload: gambar ulang seadanya, tanpa mengarang isinya.
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-[2px] bg-[#1b1a22] px-4 text-center">
          <span className="text-4xl">{m.emoji}</span>
          <span className="text-[13px] text-[#cdbfae]">{photo.alt}</span>
        </div>
      )}
      <figcaption className="mt-3 text-center font-hand text-xl text-[#3a2f2a]">{photo.caption}</figcaption>
    </motion.figure>
  );
}

// ── satu momen ─────────────────────────────────────────────────────────────────
export function StoryMomentScene({
  m,
  media,
  onNext,
}: {
  m: StoryMoment;
  media: StoryMedia;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const act = actOf(m.act);
  // Urutan: kalimat-kalimat `before` → (headline) + chat/foto → kalimat `after`.
  const centre = 1;
  const total = m.before.length + centre + m.after.length;
  const [n, setN] = useState(Math.min(1, total));
  const done = n >= total;
  const shownBefore = m.before.slice(0, n);
  const showCentre = n > m.before.length;
  const shownAfter = m.after.slice(0, Math.max(0, n - m.before.length - centre));

  return (
    <div
      onClick={() => !done && setN((v) => v + 1)}
      className={`flex min-h-[100dvh] w-full flex-col items-center px-6 pt-24 pb-40 text-center ${
        done ? "" : "cursor-pointer"
      }`}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <motion.div
          className="mb-8"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <p className={`font-mono text-[11px] uppercase tracking-[0.32em] ${FAINT}`}>
            {m.emoji} {act.title} · {act.sub}
          </p>
          <h2 className={`mt-3 text-balance font-display text-2xl sm:text-3xl ${INK}`}>{m.title}</h2>
        </motion.div>

        <div className="flex flex-col items-center gap-6">
          {shownBefore.map((line, i) => (
            <Reveal key={i}>
              <p
                className={`max-w-prose whitespace-pre-line text-balance font-display text-[1.25rem] leading-relaxed sm:text-2xl ${INK}`}
              >
                {line}
              </p>
            </Reveal>
          ))}
        </div>

        {showCentre ? (
          <>
            {m.headline ? (
              <Reveal className="mt-8">
                <p className={`font-display text-3xl italic sm:text-4xl ${WARM}`}>{m.headline}</p>
              </Reveal>
            ) : null}
            {m.photo ? <Polaroid m={m} src={media[m.photo.key]} /> : null}
            {m.chat ? <ChatThread chat={m.chat} act={act} /> : null}
          </>
        ) : null}

        {shownAfter.length > 0 ? (
          <div className="mt-10 flex flex-col items-center gap-5">
            {shownAfter.map((line, i) => (
              <Reveal key={i}>
                <p className={`max-w-prose whitespace-pre-line text-balance font-display text-xl leading-relaxed ${WARM}`}>
                  {line}
                </p>
              </Reveal>
            ))}
          </div>
        ) : null}

        {done ? <NextButton onNext={onNext} /> : <TapHint label={UI.tapHint} />}
      </div>
    </div>
  );
}

// ── rekap di "Look how far we've come" ─────────────────────────────────────────
export const STORY_RECAP_ITEMS: { emoji: string; label: string; act?: boolean }[] = STORY_ACTS.flatMap((a) => [
  { emoji: a.emoji, label: a.recap, act: true },
  ...STORY_MOMENTS.filter((m) => m.act === a.id && m.recap).map((m) => ({ emoji: m.emoji, label: m.marker })),
]);

export function StoryRecap() {
  if (STORY_RECAP_ITEMS.length === 0) return null;
  const items = [...STORY_RECAP_ITEMS, { emoji: "♡", label: STORY_RECAP.today, act: true }];
  return (
    <div className="mt-10 flex flex-col items-center">
      <Reveal>
        <p className={`mb-5 font-hand text-2xl ${ACCENT}`}>{STORY_RECAP.title}</p>
      </Reveal>
      {items.map((it, i) => (
        <Reveal key={`${it.label}-${i}`} delay={0.3 + i * 0.28} className="flex flex-col items-center">
          {i > 0 ? <span aria-hidden className="h-4 w-px bg-[#f4ead9]/25" /> : null}
          <p
            className={
              it.act
                ? `py-1 font-display text-xl ${i === items.length - 1 ? WARM : INK}`
                : `py-0.5 text-[15px] ${SOFT}`
            }
          >
            <span className="mr-2">{it.emoji}</span>
            {it.label}
          </p>
        </Reveal>
      ))}
    </div>
  );
}

// ── video — "Dan ternyata… kita sudah sejauh ini." ─────────────────────────────
export function ReelScene({
  src,
  onVideoPlay,
  onVideoStop,
  onNext,
}: {
  src: string | undefined;
  onVideoPlay: () => void;
  onVideoStop: () => void;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  // 0..lines → arrive → video → end
  const [n, setN] = useState(1);
  const [stage, setStage] = useState<"lines" | "video" | "end">("lines");
  const [started, setStarted] = useState(false);
  const [endN, setEndN] = useState(1);
  const linesDone = n > REEL.lines.length;
  const endLines = REEL.end.lines.length + 1; // + "but"
  const endDone = endN > endLines;

  function advance() {
    if (stage === "lines") {
      if (!linesDone) setN((v) => v + 1);
      else setStage(src ? "video" : "end");
    } else if (stage === "end" && !endDone) setEndN((v) => v + 1);
  }

  function finishVideo() {
    onVideoStop();
    setStage("end");
  }

  const clickable = stage === "lines" || (stage === "end" && !endDone);

  return (
    <div
      onClick={advance}
      className={`flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 pt-24 pb-24 text-center ${
        clickable ? "cursor-pointer" : ""
      }`}
    >
      {stage === "lines" ? (
        <div className="flex max-w-md flex-col items-center gap-6">
          {REEL.lines.slice(0, n).map((line, i) => (
            <Reveal key={i}>
              <p className={`whitespace-pre-line text-balance font-display text-xl leading-relaxed ${SOFT}`}>
                {line}
              </p>
            </Reveal>
          ))}
          {linesDone ? (
            <Reveal delay={0.4}>
              <p className={`font-display text-3xl ${INK}`}>{REEL.arrive}</p>
            </Reveal>
          ) : null}
          <TapHint label={UI.tapHint} />
        </div>
      ) : null}

      {stage === "video" ? (
        <motion.div
          onClick={stopPropagation}
          className="flex w-full flex-col items-center"
          initial={reduce ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        >
          <p className={`mb-6 font-hand text-2xl ${ACCENT}`}>{REEL.video.caption}</p>
          <div className="relative overflow-hidden rounded-2xl border border-[#f4ead9]/15 bg-black shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
            <video
              ref={video}
              src={src}
              playsInline
              controls={started}
              preload="metadata"
              onPlay={() => {
                setStarted(true);
                onVideoPlay();
              }}
              onPause={onVideoStop}
              onEnded={finishVideo}
              className="block max-h-[70dvh] w-auto max-w-full"
            />
            {!started ? (
              <button
                type="button"
                onClick={() => void video.current?.play()}
                className="absolute inset-0 flex items-center justify-center bg-black/35 transition hover:bg-black/25"
              >
                <span className={`text-[15px] ${BTN}`}>{REEL.play}</span>
              </button>
            ) : null}
          </div>
          <button type="button" onClick={finishVideo} className={`mt-6 ${SMALL_BTN}`}>
            {REEL.skip}
          </button>
        </motion.div>
      ) : null}

      {stage === "end" ? (
        <div className="flex max-w-md flex-col items-center gap-6">
          <Reveal>
            <p className={`font-display text-3xl sm:text-4xl ${INK}`}>{REEL.end.title}</p>
          </Reveal>
          {REEL.end.lines.slice(0, endN).map((line, i) => (
            <Reveal key={i}>
              <p className={`whitespace-pre-line text-balance font-display text-xl leading-relaxed ${SOFT}`}>
                {line}
              </p>
            </Reveal>
          ))}
          {endN > REEL.end.lines.length ? (
            <Reveal>
              <p className={`font-display text-2xl italic ${WARM}`}>{REEL.end.but}</p>
            </Reveal>
          ) : null}
          {endDone ? (
            <>
              <Reveal delay={0.6}>
                <p className={`font-hand text-4xl ${ACCENT}`}>{REEL.end.final}</p>
              </Reveal>
              <NextButton onNext={onNext} />
            </>
          ) : (
            <TapHint label={UI.tapHint} />
          )}
        </div>
      ) : null}
    </div>
  );
}
