"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { WatchSourceKind } from "@/lib/supabase/database.types";
import { whenYouTubeApiReady, type YTPlayer } from "@/lib/youtube";
import { cn } from "@/lib/utils";

/**
 * One shared watch screen — whatever you brought.
 *
 *  youtube · the official IFrame Player API. Native controls are off so the
 *            room's own bar is the only way to move, and both players can't
 *            quietly diverge through YouTube's UI.
 *  file    · a plain <video>. Same deal.
 *  embed   · somebody else's page, in an iframe. We cannot reach inside it, and
 *            we don't try: the handle's methods are no-ops and the room keeps
 *            you together by counting you in instead.
 */

export type StageHandle = {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  getTime: () => number;
  getDuration: () => number | null;
  /** False for an embed — nothing here can be driven from code. */
  controllable: boolean;
};

type Props = {
  kind: WatchSourceKind;
  url: string;
  videoId: string | null;
  posterUrl: string | null;
  /** The player really did change state (either from us or from the player). */
  onStateChange?: (playing: boolean, atSeconds: number, duration: number | null) => void;
  onReady?: () => void;
  onEnded?: () => void;
  /** Reactions, presence, the pause moment — drawn over the picture. */
  overlay?: React.ReactNode;
  /** Tap the picture to toggle. Ignored for an embed. */
  onTap?: () => void;
  className?: string;
};

export const VideoStage = forwardRef<StageHandle, Props>(function VideoStage(
  { kind, url, videoId, posterUrl, onStateChange, onReady, onEnded, overlay, onTap, className },
  ref,
) {
  const controllable = kind === "youtube" || kind === "file";

  const ytHostRef = useRef<HTMLDivElement>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const builtRef = useRef(false);
  const [ytReady, setYtReady] = useState(false);

  // Latest callbacks, so the YouTube player can be built exactly once. Synced
  // in an effect declared before the one that builds it.
  const cbRef = useRef({ onStateChange, onReady, onEnded });
  useEffect(() => {
    cbRef.current = { onStateChange, onReady, onEnded };
  }, [onEnded, onReady, onStateChange]);

  // ---- YouTube ------------------------------------------------------------
  useEffect(() => {
    if (kind !== "youtube" || !videoId || builtRef.current) return;
    builtRef.current = true;

    whenYouTubeApiReady(() => {
      const host = ytHostRef.current;
      if (!host || !window.YT) return;
      // The target node is created outside React's reconciliation, because the
      // API replaces it with its own iframe.
      const target = document.createElement("div");
      target.style.width = "100%";
      target.style.height = "100%";
      host.appendChild(target);

      ytRef.current = new window.YT.Player(target, {
        videoId,
        playerVars: {
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          fs: 0,
        },
        events: {
          onReady: () => {
            setYtReady(true);
            cbRef.current.onReady?.();
          },
          onStateChange: (e) => {
            const YT = window.YT;
            if (!YT) return;
            const p = ytRef.current;
            const at = p?.getCurrentTime?.() ?? 0;
            const dur = p?.getDuration?.() ?? 0;
            if (e.data === YT.PlayerState.ENDED) {
              cbRef.current.onStateChange?.(false, at, dur > 0 ? dur : null);
              cbRef.current.onEnded?.();
              return;
            }
            if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.PAUSED) {
              cbRef.current.onStateChange?.(
                e.data === YT.PlayerState.PLAYING,
                at,
                dur > 0 ? dur : null,
              );
            }
          },
        },
      });
    });
  }, [kind, videoId]);

  useEffect(() => {
    return () => {
      ytRef.current?.destroy?.();
      ytRef.current = null;
      builtRef.current = false;
    };
  }, []);

  // ---- the imperative handle the room drives -------------------------------
  const play = useCallback(() => {
    if (kind === "youtube") ytRef.current?.playVideo();
    else if (kind === "file") void videoRef.current?.play().catch(() => {});
  }, [kind]);

  const pause = useCallback(() => {
    if (kind === "youtube") ytRef.current?.pauseVideo();
    else if (kind === "file") videoRef.current?.pause();
  }, [kind]);

  const seek = useCallback(
    (seconds: number) => {
      if (kind === "youtube") ytRef.current?.seekTo(seconds, true);
      else if (kind === "file" && videoRef.current) videoRef.current.currentTime = seconds;
    },
    [kind],
  );

  useImperativeHandle(
    ref,
    (): StageHandle => ({
      play,
      pause,
      seek,
      controllable,
      getTime: () => {
        if (kind === "youtube") return ytRef.current?.getCurrentTime?.() ?? 0;
        if (kind === "file") return videoRef.current?.currentTime ?? 0;
        return 0;
      },
      getDuration: () => {
        const d =
          kind === "youtube"
            ? (ytRef.current?.getDuration?.() ?? 0)
            : kind === "file"
              ? (videoRef.current?.duration ?? 0)
              : 0;
        return Number.isFinite(d) && d > 0 ? d : null;
      },
    }),
    [controllable, kind, pause, play, seek],
  );

  // A <video> ready enough to be driven counts as ready.
  const handleLoaded = useCallback(() => {
    const v = videoRef.current;
    cbRef.current.onReady?.();
    if (v) cbRef.current.onStateChange?.(!v.paused, v.currentTime, Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null);
  }, []);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-2xl bg-[#0b0a0c]",
        className,
      )}
    >
      {kind === "youtube" ? (
        <>
          {/* React owns this wrapper and leaves it empty; YT fills it. */}
          <div ref={ytHostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
          {!ytReady ? <Loading poster={posterUrl} /> : null}
        </>
      ) : null}

      {kind === "file" ? (
        <video
          ref={videoRef}
          src={url}
          poster={posterUrl ?? undefined}
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full bg-black object-contain"
          onLoadedMetadata={handleLoaded}
          onPlay={() => {
            const v = videoRef.current;
            if (v) cbRef.current.onStateChange?.(true, v.currentTime, durationOf(v));
          }}
          onPause={() => {
            const v = videoRef.current;
            if (v) cbRef.current.onStateChange?.(false, v.currentTime, durationOf(v));
          }}
          onEnded={() => cbRef.current.onEnded?.()}
        />
      ) : null}

      {kind === "embed" ? (
        <iframe
          src={url}
          title="Watch together"
          className="absolute inset-0 h-full w-full border-0 bg-black"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : null}

      {/* Tap-to-toggle sits above a player we control, below the overlay.
          An embed keeps its own click handling — the site owns that player. */}
      {controllable && onTap ? (
        <button
          type="button"
          onClick={onTap}
          aria-label="Play atau pause"
          className="absolute inset-0 z-10 cursor-pointer bg-transparent focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white/70"
        />
      ) : null}

      {overlay ? (
        <div className="pointer-events-none absolute inset-0 z-20">{overlay}</div>
      ) : null}
    </div>
  );
});

function durationOf(v: HTMLVideoElement): number | null {
  return Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null;
}

function Loading({ poster }: { poster: string | null }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#0b0a0c]">
      {poster ? (
        // A backdrop while the player wakes up; decorative, so no alt text.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      ) : null}
      <p className="relative font-mono text-xs tracking-[0.18em] text-white/60 uppercase">
        menyiapkan…
      </p>
    </div>
  );
}
