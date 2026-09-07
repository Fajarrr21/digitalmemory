"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_VOICE_SECONDS } from "@/lib/media-config";

export type VoiceState =
  | { kind: "unchanged" } // keep whatever already exists (initial)
  | { kind: "removed" } // no audio now (delete any existing)
  | { kind: "new"; blob: Blob; url: string; durationSec: number; mime: string };

type Recorded = { blob: Blob; url: string; durationSec: number; mime: string };

/** Ordered by preference; the first the browser supports wins. Safari/iOS
 *  supports audio/mp4; Chrome/Firefox/Android prefer webm+opus. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/aac",
];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* isTypeSupported can throw on some engines — keep trying */
    }
  }
  return undefined; // let the browser choose its default
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceRecorder({
  existingUrl = null,
  onChange,
  disabled = false,
}: {
  existingUrl?: string | null;
  onChange: (s: VoiceState) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rec, setRec] = useState<Recorded | null>(null);
  const [removedExisting, setRemovedExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clean up stream + object URLs on unmount.
  useEffect(() => {
    return () => {
      stopTracks();
      if (rec?.url) URL.revokeObjectURL(rec.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Browser ini belum mendukung rekam suara.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const type = mr.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        stopTracks();
        setRecording(false);
        // Replace any previous recording.
        setRec((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return { blob, url, durationSec, mime: type };
        });
        onChange({ kind: "new", blob, url, durationSec, mime: type });
      };
      recorderRef.current = mr;
      startedAtRef.current = Date.now();
      mr.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        const secs = Math.round((Date.now() - startedAtRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_VOICE_SECONDS) stop();
      }, 250);
    } catch (err) {
      stopTracks();
      setRecording(false);
      const name = (err as { name?: string })?.name;
      setError(
        name === "NotAllowedError"
          ? "Izin mikrofon ditolak. Aktifkan dulu ya buat rekam suara."
          : "Nggak bisa mulai merekam. Coba lagi ya.",
      );
    }
  }

  function stop() {
    try {
      recorderRef.current?.stop();
    } catch {
      /* already stopped */
    }
  }

  function remove() {
    if (rec?.url) URL.revokeObjectURL(rec.url);
    setRec(null);
    setRemovedExisting(true);
    onChange({ kind: "removed" });
  }

  const showExisting = !!existingUrl && !removedExisting && !rec && !recording;
  const playUrl = rec?.url ?? (showExisting ? existingUrl : null);

  return (
    <div className="flex flex-col gap-2">
      {recording ? (
        <div className="flex items-center gap-3 rounded-xl border border-accent/50 bg-blush/30 px-3.5 py-2.5">
          <span className="flex h-2.5 w-2.5 flex-none animate-pulse rounded-full bg-danger" aria-hidden />
          <span className="font-mono text-sm text-ink">Merekam… {fmt(elapsed)}</span>
          <button
            type="button"
            onClick={stop}
            className="ml-auto rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-[#4a2b30] hover:brightness-95"
          >
            Selesai
          </button>
        </div>
      ) : playUrl ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rule bg-ground/60 p-2.5">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={playUrl} controls preload="metadata" className="h-9 min-w-0 flex-1" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={start}
              disabled={disabled}
              className="rounded-full border border-rule px-3 py-1.5 text-xs text-ink-soft hover:border-accent-ink/40 hover:text-accent-ink"
            >
              Rekam ulang
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={disabled}
              className="rounded-full border border-rule px-3 py-1.5 text-xs text-ink-faint hover:border-danger/40 hover:text-danger"
            >
              Hapus
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className="flex items-center gap-2 self-start rounded-full border border-rule px-4 py-2 text-sm text-ink-soft transition hover:border-accent-ink/40 hover:text-accent-ink disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          Rekam suara
        </button>
      )}

      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
