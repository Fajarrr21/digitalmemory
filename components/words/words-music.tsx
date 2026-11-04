"use client";

import { useEffect, useRef, useState } from "react";
import { whenYouTubeApiReady, type YTPlayer } from "@/lib/youtube";
import { WORDS_SONGS, nextIndex, segmentDone, volumeAt } from "@/lib/words/soundtrack";
import { cn } from "@/lib/utils";

/**
 * The little words. soundtrack — a small ♪ that lives on every /words page
 * (it's mounted in the words layout, so it keeps playing as you move between
 * the Muse, the Library, a reading…). Plays only the chosen moment of each
 * song, fades the seams, loops. Never starts by itself: browsers need a tap
 * before sound, and a writing room shouldn't surprise anyone. Remembers on
 * this device whether you had it on, so it offers to continue.
 */
const PREF = "words:music";

export function WordsMusic() {
  const host = useRef<HTMLDivElement | null>(null);
  const player = useRef<YTPlayer | null>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wasOn, setWasOn] = useState(false);
  const [open, setOpen] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a per-device preference
      setWasOn(localStorage.getItem(PREF) === "on");
    } catch {}
  }, []);

  function remember(on: boolean) {
    try {
      localStorage.setItem(PREF, on ? "on" : "off");
    } catch {}
  }

  function load(i: number) {
    const seg = WORDS_SONGS[i];
    indexRef.current = i;
    setIndex(i);
    player.current?.setVolume?.(0);
    player.current?.loadVideoById({ videoId: seg.youtubeId, startSeconds: seg.start, endSeconds: seg.end });
  }

  function advance() {
    load(nextIndex(indexRef.current));
  }

  function start() {
    setLoading(true);
    remember(true);
    if (player.current) {
      if (started.current) player.current.playVideo();
      else {
        started.current = true;
        load(indexRef.current);
      }
      return;
    }
    whenYouTubeApiReady(() => {
      if (!host.current || !window.YT || player.current) return;
      const target = document.createElement("div");
      host.current.appendChild(target);
      player.current = new window.YT.Player(target, {
        playerVars: { playsinline: 1, controls: 0, rel: 0, modestbranding: 1, disablekb: 1 },
        events: {
          onReady: () => {
            started.current = true;
            load(indexRef.current);
          },
          onStateChange: (e) => {
            const S = window.YT?.PlayerState;
            if (!S) return;
            if (e.data === S.PLAYING) {
              setPlaying(true);
              setLoading(false);
            } else if (e.data === S.PAUSED) {
              setPlaying(false);
            } else if (e.data === S.ENDED) {
              // endSeconds reached — on to the next moment.
              advance();
            }
          },
          // A video that can't be embedded any more: skip it rather than stall.
          onError: () => advance(),
        },
      });
    });
  }

  function pause() {
    player.current?.pauseVideo();
    setPlaying(false);
    remember(false);
  }

  // Fade the seams, and advance even if endSeconds is ignored.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const seg = WORDS_SONGS[indexRef.current];
      const now = p.getCurrentTime();
      p.setVolume?.(volumeAt(now, seg));
      if (segmentDone(now, seg)) advance();
    }, 250);
    return () => clearInterval(t);
    // advance/load only touch refs + stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => () => player.current?.destroy(), []);

  const seg = WORDS_SONGS[index];

  return (
    <>
      <div ref={host} aria-hidden className="pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0" />
      <div className="fixed bottom-[5.75rem] left-4 z-40 flex items-center gap-2 md:bottom-6 md:left-auto md:right-6">
        {open || playing || loading ? (
          <div className="hidden max-w-[14rem] rounded-full border border-rule bg-paper/95 px-3 py-1.5 text-xs shadow-[var(--shadow-lift)] backdrop-blur sm:block">
            <span className="block truncate font-display italic text-ink">{seg.title}</span>
            <span className="block truncate text-[10px] text-ink-faint">{seg.artist}</span>
          </div>
        ) : null}
        {playing ? (
          <button
            type="button"
            onClick={advance}
            aria-label="Lagu berikutnya"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-rule bg-paper/95 text-sm text-ink-soft shadow-[var(--shadow-lift)] backdrop-blur hover:text-accent-ink sm:flex"
          >
            ⏭
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => (playing ? pause() : start())}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          aria-pressed={playing}
          aria-label={playing ? `Jeda lagu — ${seg.title}, ${seg.artist}` : `Putar lagu — ${seg.title}, ${seg.artist}`}
          title={playing ? `${seg.title} · ${seg.artist}` : wasOn ? "Lanjutkan lagunya" : "Putar lagu"}
          className={cn(
            "flex h-11 items-center justify-center gap-1.5 rounded-full border px-3.5 text-sm shadow-[var(--shadow-soft)] backdrop-blur transition",
            playing ? "border-accent-ink/40 bg-blush/80 text-ink" : "border-rule bg-paper/95 text-ink-soft hover:text-accent-ink",
          )}
        >
          {loading && !playing ? (
            <span className="animate-pulse">♪</span>
          ) : playing ? (
            <Bars />
          ) : (
            <span>♪</span>
          )}
          <span className="text-xs">{playing ? "jeda" : wasOn ? "lanjutkan" : "lagu"}</span>
        </button>
      </div>
    </>
  );
}

function Bars() {
  return (
    <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-accent-ink motion-safe:animate-[words-bar_900ms_ease-in-out_infinite]"
          style={{ height: "100%", transformOrigin: "bottom", transform: "scaleY(0.6)", animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
