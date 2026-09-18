"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { soundtrackConfig, type SoundtrackSong } from "./soundtrack-config";

const cfg = soundtrackConfig;
const songs = cfg.songs;
const total = songs.length;

// Simpan lagu terakhir yang dibuka, biar dia bisa lanjut kapan-kapan.
const STORAGE_KEY = "soundtrack:progress";

function loadProgress(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 && n < total ? n : 0;
  } catch {
    return 0;
  }
}
function saveProgress(i: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(i));
  } catch {
    // best-effort — kalau storage diblokir ya sudah.
  }
}

// Nomor dua digit: 1 -> "01".
const pad = (n: number) => String(n).padStart(2, "0");

// Waktu detik -> "M:SS".
function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Cover: pakai yang kamu isi, kalau kosong jatuh ke thumbnail YouTube.
function coverFor(song: SoundtrackSong): string | null {
  if (song.cover) return song.cover;
  if (song.youtubeId) return `https://i.ytimg.com/vi/${song.youtubeId}/hqdefault.jpg`;
  return null;
}

/* ---------- Tipe minimal untuk YouTube IFrame API ---------- */

type YTPlayer = {
  loadVideoById: (o: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};
type YTPlayerOptions = {
  videoId?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onStateChange?: (e: { data: number }) => void;
  };
};
declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Pastikan script API-nya kebuka sekali saja, lalu panggil cb saat siap.
function whenYouTubeApiReady(cb: () => void) {
  if (typeof window === "undefined") return;
  if (window.YT && window.YT.Player) {
    cb();
    return;
  }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prev?.();
    cb();
  };
  if (!document.getElementById("st-yt-api")) {
    const s = document.createElement("script");
    s.id = "st-yt-api";
    s.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(s);
  }
}

type Phase = "opening" | "playing" | "ending";

export function Soundtrack() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("opening");
  const [index, setIndex] = useState(0);
  const [resumeAt, setResumeAt] = useState(0);

  // status pemutar
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef<YTPlayer | null>(null);
  const hostWrapRef = useRef<HTMLDivElement>(null); // React-owned, dibiarkan kosong
  const startedRef = useRef(false); // player sudah dibuat?

  useEffect(() => {
    setResumeAt(loadProgress());
  }, []);

  const current = songs[index];
  const hasSong = !!current && current.youtubeId.length > 0;
  const isLast = index >= total - 1;

  // Buat player sekali, saat perjalanan dimulai (dipicu ketukan = boleh autoplay).
  const ensurePlayer = useCallback(() => {
    if (startedRef.current || !hostWrapRef.current) return;
    startedRef.current = true;
    whenYouTubeApiReady(() => {
      const wrap = hostWrapRef.current;
      if (!wrap || !window.YT) return;
      // Node target dibuat manual (di luar reconciliation React) supaya aman
      // saat YT menggantinya dengan iframe.
      const target = document.createElement("div");
      wrap.appendChild(target);
      playerRef.current = new window.YT.Player(target, {
        playerVars: {
          playsinline: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e) => {
            if (!window.YT) return;
            setIsPlaying(e.data === window.YT.PlayerState.PLAYING);
          },
        },
      });
    });
  }, []);

  // Muat lagu saat siap / saat ganti lagu (termasuk saat penutup: biarkan lagu
  // terakhir tetap mengalir di balik kata-kata penutup).
  useEffect(() => {
    if (!ready || (phase !== "playing" && phase !== "ending")) return;
    const song = songs[index];
    if (song?.youtubeId) {
      playerRef.current?.loadVideoById({
        videoId: song.youtubeId,
        startSeconds: song.startSeconds ?? 0,
      });
    } else {
      playerRef.current?.stopVideo?.();
      setCurrentTime(0);
      setDuration(0);
    }
  }, [ready, phase, index]);

  // Denyut progress — baca waktu asli dari player tiap 250ms.
  useEffect(() => {
    if (!ready || phase === "opening") return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (p?.getCurrentTime) {
        setCurrentTime(p.getCurrentTime() || 0);
        setDuration(p.getDuration() || 0);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [ready, phase]);

  // Bersihkan saat komponen dilepas.
  useEffect(() => {
    return () => {
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, []);

  function begin(at: number) {
    setIndex(at);
    setPhase("playing");
    saveProgress(at);
    ensurePlayer();
  }
  function goTo(next: number) {
    setIndex(next);
    saveProgress(next);
  }
  function next() {
    if (isLast) {
      setPhase("ending");
      return;
    }
    goTo(index + 1);
  }
  function prev() {
    if (index > 0) goTo(index - 1);
  }
  function togglePlay() {
    const p = playerRef.current;
    if (!p) return;
    if (isPlaying) p.pauseVideo();
    else p.playVideo();
  }
  function seekTo(seconds: number) {
    playerRef.current?.seekTo(seconds, true);
    setCurrentTime(seconds);
  }
  function replay() {
    setPhase("opening");
    setIndex(0);
    setResumeAt(0);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    playerRef.current?.stopVideo?.();
    saveProgress(0);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ground text-ink">
      {/* pemutar tersembunyi (audio only) */}
      <div
        ref={hostWrapRef}
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-px w-px overflow-hidden opacity-0"
      />

      {/* nuansa malam & sinematik */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 108%, var(--blush) 0%, transparent 55%)",
          opacity: 0.7,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 160px 40px rgba(0,0,0,0.16)" }}
      />

      <AnimatePresence mode="wait">
        {phase === "opening" ? (
          <Opening key="opening" reduce={reduce} resumeAt={resumeAt} onBegin={begin} />
        ) : phase === "playing" ? (
          <motion.div
            key="playing"
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
          >
            {/* progress bab (chapter) di atas */}
            <div className="relative z-10 flex flex-col items-center gap-2 px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
              <Hearts count={total} filled={index + 1} />
            </div>

            {/* satu lagu = satu kartu now-playing */}
            <div className="relative z-10 flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
              <AnimatePresence mode="wait">
                <NowPlaying
                  key={index}
                  song={current}
                  index={index}
                  reduce={reduce}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration}
                  onToggle={togglePlay}
                  onSeek={seekTo}
                />
              </AnimatePresence>
            </div>

            {/* kontrol bawah */}
            <div className="relative z-10 flex items-center justify-between gap-3 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={prev}
                disabled={index === 0}
                className="font-mono text-xs tracking-wide text-ink-faint transition enabled:hover:text-ink-soft disabled:opacity-0"
              >
                ← {cfg.prevLabel}
              </button>
              <motion.button
                type="button"
                onClick={next}
                className="rounded-full border border-rule bg-paper/70 px-5 py-2.5 text-sm text-ink-soft backdrop-blur transition hover:border-accent-ink/40 hover:text-ink"
                whileTap={reduce ? undefined : { scale: 0.97 }}
              >
                {isLast ? cfg.lastNextLabel : cfg.nextLabel}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <Ending key="ending" reduce={reduce} onReplay={replay} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Layar pembuka ---------- */

function Opening({
  reduce,
  resumeAt,
  onBegin,
}: {
  reduce: boolean | null;
  resumeAt: number;
  onBegin: (at: number) => void;
}) {
  const subtitle = cfg.opening.subtitle.replaceAll("{n}", String(total));
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      <motion.p
        className="font-mono text-[11px] tracking-[0.3em] text-ink-faint uppercase"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        ♫
      </motion.p>
      <motion.h1
        className="mt-4 font-display text-4xl font-medium text-ink text-balance sm:text-5xl"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.15 }}
      >
        {cfg.opening.title}
      </motion.h1>
      <motion.p
        className="mt-4 font-hand text-2xl text-accent-ink text-balance"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.5 }}
      >
        {subtitle}
      </motion.p>

      <motion.div
        className="mt-10 flex flex-col items-center gap-3"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
      >
        <button
          type="button"
          onClick={() => onBegin(resumeAt > 0 ? resumeAt : 0)}
          className="rounded-full border border-accent-ink/30 bg-paper/70 px-6 py-3 text-base text-ink backdrop-blur transition hover:border-accent-ink/60 hover:-translate-y-0.5"
        >
          {resumeAt > 0
            ? `${cfg.opening.resumeLabel} · lagu ${pad(resumeAt + 1)}`
            : cfg.opening.beginLabel}
        </button>
        {resumeAt > 0 ? (
          <button
            type="button"
            onClick={() => onBegin(0)}
            className="font-mono text-xs tracking-wide text-ink-faint transition hover:text-ink-soft"
          >
            {cfg.opening.restartLabel}
          </button>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

/* ---------- Kartu "now playing" ---------- */

function NowPlaying({
  song,
  index,
  reduce,
  isPlaying,
  currentTime,
  duration,
  onToggle,
  onSeek,
}: {
  song: SoundtrackSong;
  index: number;
  reduce: boolean | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
}) {
  const cover = coverFor(song);
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  function onBar(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(frac * duration);
  }

  return (
    <motion.div
      className="mx-auto flex w-full max-w-md flex-col items-center px-6 pt-2 pb-10 text-center"
      initial={reduce ? false : { opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -16 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      {/* header kecil */}
      <span className="font-mono text-[11px] tracking-[0.3em] text-accent-ink/80 uppercase">
        ♫ Our Songs
      </span>
      <span className="mt-1 font-mono text-[10px] tracking-[0.2em] text-ink-faint uppercase">
        {pad(index + 1)} / {pad(total)} · currently playing
      </span>

      {/* cover — fokus utama, denyut lembut saat main */}
      <motion.div
        className="mt-5 aspect-square w-56 overflow-hidden rounded-2xl border border-rule bg-paper shadow-[0_18px_50px_-18px_rgba(0,0,0,0.45)]"
        initial={reduce ? false : { opacity: 0, scale: 0.94 }}
        animate={{
          opacity: 1,
          scale: !reduce && isPlaying ? [1, 1.015, 1] : 1,
        }}
        transition={{
          opacity: { duration: 0.8 },
          scale: isPlaying
            ? { duration: 5, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.6 },
        }}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={`${song.title} — ${song.artist}`}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl opacity-40">
            🎧
          </div>
        )}
      </motion.div>

      {/* judul + artis */}
      <h2 className="mt-6 font-display text-2xl font-medium text-ink text-balance">
        {song.title}
      </h2>
      <p className="mt-1 font-mono text-sm text-ink-soft">{song.artist}</p>

      {/* progress bar + waktu asli */}
      <div className="mt-6 w-full">
        <div
          role="slider"
          aria-label="Posisi lagu"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          onClick={onBar}
          className="group h-2 w-full cursor-pointer rounded-full bg-rule"
        >
          <div
            className="relative h-full rounded-full bg-accent-ink/70"
            style={{ width: `${pct}%` }}
          >
            <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-accent-ink opacity-0 transition group-hover:opacity-100" />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-ink-faint">
          <span>{fmtTime(currentTime)}</span>
          <span>{duration > 0 ? fmtTime(duration) : "–:––"}</span>
        </div>
      </div>

      {/* play / pause */}
      <button
        type="button"
        onClick={onToggle}
        disabled={song.youtubeId.length === 0}
        aria-label={isPlaying ? "Jeda" : "Putar"}
        className="mt-5 flex h-14 w-14 items-center justify-center rounded-full border border-accent-ink/30 bg-paper/80 text-xl text-accent-ink shadow-sm backdrop-blur transition hover:border-accent-ink/60 enabled:hover:-translate-y-0.5 disabled:opacity-40"
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>
      {song.youtubeId.length === 0 ? (
        <span className="mt-2 font-mono text-[10px] text-ink-faint">
          belum ada lagu (isi youtubeId di config)
        </span>
      ) : null}

      {/* pesan dari kamu — surat kecil untuk lagu ini, enak dibaca & bisa di-scroll */}
      <div className="mt-8 flex w-full flex-col gap-4 text-left">
        {song.message.map((para, i) => (
          <motion.p
            key={i}
            className="text-[15px] leading-relaxed text-ink-soft text-pretty sm:text-base"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: Math.min(0.3 + i * 0.1, 1.6) }}
          >
            {para}
          </motion.p>
        ))}
      </div>

      <motion.span
        className="mt-6 text-lg text-accent-ink/80"
        aria-hidden
        animate={reduce ? undefined : { scale: [1, 1.15, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        ♡
      </motion.span>
    </motion.div>
  );
}

/* ---------- Deretan hati sebagai progress ---------- */

function Hearts({ count, filled }: { count: number; filled: number }) {
  if (count > 14) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-rule">
          <motion.div
            className="h-full rounded-full bg-accent-ink/70"
            initial={false}
            animate={{ width: `${(filled / count) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <span className="font-mono text-[10px] text-ink-faint">
          {pad(filled)} / {pad(count)}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={i < filled ? "text-accent-ink" : "text-ink-faint/40"}
          aria-hidden
        >
          {i < filled ? "♥" : "○"}
        </span>
      ))}
    </div>
  );
}

/* ---------- Penutup ---------- */

function Ending({
  reduce,
  onReplay,
}: {
  reduce: boolean | null;
  onReplay: () => void;
}) {
  return (
    <motion.div
      key="ending"
      className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
    >
      <motion.h2
        className="font-display text-3xl font-medium text-ink text-balance sm:text-4xl"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.3 }}
      >
        {cfg.ending.title}
      </motion.h2>
      <motion.p
        className="mt-3 font-hand text-2xl text-accent-ink text-balance"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.7 }}
      >
        {cfg.ending.line}
      </motion.p>

      <div className="mt-8 flex max-w-md flex-col gap-3">
        {cfg.ending.message.map((line, i) => (
          <motion.p
            key={i}
            className="text-[15px] leading-relaxed text-ink-soft text-pretty sm:text-base"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.2 + i * 0.6 }}
          >
            {line}
          </motion.p>
        ))}
      </div>

      <motion.div
        className="mt-10 flex flex-col items-center gap-3"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 + cfg.ending.message.length * 0.6 + 0.4 }}
      >
        <Link
          href="/"
          className="rounded-full border border-accent-ink/30 bg-paper/70 px-6 py-3 text-base text-ink backdrop-blur transition hover:border-accent-ink/60 hover:-translate-y-0.5"
        >
          {cfg.ending.backLabel}
        </Link>
        <button
          type="button"
          onClick={onReplay}
          className="font-mono text-xs tracking-wide text-ink-faint transition hover:text-ink-soft"
        >
          {cfg.ending.replayLabel}
        </button>
      </motion.div>
    </motion.div>
  );
}
