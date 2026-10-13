"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * A small, quiet audio player for a voice left in the room. Nothing loads
 * until it's opened (preload="none" until the first play), nothing ever
 * autoplays, and every state — loading, playing, paused, can't load — is
 * said in words as well as shown.
 */
export function VoicePlayer({
  src,
  knownSeconds,
  onRetry,
  className,
}: {
  src: string | null;
  knownSeconds?: number | null;
  onRetry?: () => void;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "error">(src ? "idle" : "error");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number>(knownSeconds ?? 0);

  useEffect(() => {
    const a = audioRef.current;
    return () => a?.pause();
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a || !src) return;
    if (state === "playing") {
      a.pause();
      return;
    }
    setState((s) => (s === "idle" ? "loading" : s));
    a.play().catch(() => setState("error"));
  }

  function seek(e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    if ("key" in e) {
      if (e.key === "ArrowRight") a.currentTime = Math.min(duration, a.currentTime + 5);
      else if (e.key === "ArrowLeft") a.currentTime = Math.max(0, a.currentTime - 5);
      else return;
      e.preventDefault();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  }

  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;

  if (!src || state === "error") {
    return (
      <div role="alert" className={cn("rounded-2xl border border-rule bg-paper px-4 py-3 text-sm text-ink-soft", className)}>
        Suaranya belum bisa diputar sekarang.
        {onRetry ? (
          <button type="button" onClick={onRetry} className="ml-1 text-accent-ink underline underline-offset-2">
            coba lagi
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-rule bg-paper px-3 py-3", className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onWaiting={() => setState("loading")}
        onPlaying={() => setState("playing")}
        onPause={() => setState("paused")}
        onEnded={() => {
          setState("paused");
          setTime(0);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onError={() => setState("error")}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={state === "playing" ? "Jeda" : "Putar suaranya"}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent text-[#4a2b30] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
      >
        {state === "loading" ? (
          <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-[#4a2b30]/30 border-t-[#4a2b30]" />
        ) : state === "playing" ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
            <rect x="3.5" y="3" width="3" height="10" rx="1" fill="currentColor" />
            <rect x="9.5" y="3" width="3" height="10" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="ml-0.5 h-4 w-4" aria-hidden>
            <path d="M4 2.8v10.4a.6.6 0 0 0 .9.5l8.3-5.2a.6.6 0 0 0 0-1L4.9 2.3a.6.6 0 0 0-.9.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Posisi suara"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${fmt(time)} dari ${fmt(duration)}`}
          onClick={seek}
          onKeyDown={seek}
          className="relative h-2 cursor-pointer rounded-full bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent-ink/70" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 flex justify-between font-mono text-[11px] text-ink-faint" aria-live="polite">
          <span>{state === "loading" ? "memuat…" : fmt(time)}</span>
          <span>{fmt(duration)}</span>
        </p>
      </div>
    </div>
  );
}
