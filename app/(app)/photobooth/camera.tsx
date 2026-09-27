"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { CAPTURE_SIZE, COUNTDOWN_FROM } from "./photobooth-config";

/**
 * The booth camera: live (mirrored) preview → 3-2-1 countdown → 📸 flash →
 * still preview with Keep / Retake. Photos are centre-cropped squares,
 * mirrored to match what the person saw. Fully client-side.
 */
export function CameraCapture({
  prompt,
  label,
  keepLabel = "✓ Keep",
  onKeep,
}: {
  /** Optional pose prompt shown above the viewfinder. */
  prompt: string | null;
  /** e.g. "Shot 2 of 4". */
  label: string | null;
  keepLabel?: string;
  onKeep: (blob: Blob, dataUrl: string) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; dataUrl: string } | null>(null);
  const [keeping, setKeeping] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCamError(null);
      setReady(true);
    } catch {
      setCamError("Kameranya belum bisa dipakai. Izinkan akses kamera di browser, lalu coba lagi ya.");
    }
  }, []);

  useEffect(() => {
    // Deferred so the permission prompt never blocks the first paint.
    const t = setTimeout(() => void startCamera(), 0);
    return () => {
      clearTimeout(t);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [startCamera]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = CAPTURE_SIZE;
    canvas.height = CAPTURE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - s) / 2;
    const sy = (video.videoHeight - s) / 2;
    // Mirror so the kept photo matches the mirrored preview.
    ctx.translate(CAPTURE_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, s, s, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

    canvas.toBlob(
      (blob) => {
        if (blob) setShot({ blob, dataUrl: canvas.toDataURL("image/jpeg", 0.86) });
      },
      "image/jpeg",
      0.88,
    );
  }

  function startCountdown() {
    let n = COUNTDOWN_FROM;
    setCount(n);
    const tick = () => {
      n -= 1;
      if (n > 0) {
        setCount(n);
        setTimeout(tick, 1000);
      } else {
        setCount(null);
        setFlash(true);
        capture();
        setTimeout(() => setFlash(false), 260);
      }
    };
    setTimeout(tick, 1000);
  }

  async function keep() {
    if (!shot) return;
    setKeeping(true);
    try {
      await onKeep(shot.blob, shot.dataUrl);
      setShot(null);
    } finally {
      setKeeping(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {label ? <p className="font-mono text-xs tracking-wide text-ink-faint">{label}</p> : null}
      {prompt ? <p className="text-center font-hand text-2xl text-accent-ink">{prompt}</p> : null}

      <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-3xl border border-rule bg-paper-2">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.dataUrl} alt="Hasil jepretan" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />
        )}

        {count !== null ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <motion.span
              key={count}
              initial={{ scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display text-8xl font-semibold text-white drop-shadow-lg"
            >
              {count}
            </motion.span>
          </div>
        ) : null}

        {flash ? <div className="absolute inset-0 bg-white" /> : null}

        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
            <p className="text-sm text-ink-soft">{camError}</p>
            <Button type="button" variant="soft" size="sm" onClick={startCamera}>
              Coba lagi
            </Button>
          </div>
        ) : null}
      </div>

      {shot ? (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={keep} disabled={keeping}>
            {keeping ? "Menyimpan…" : keepLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setShot(null)} disabled={keeping}>
            ↻ Retake
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          onClick={startCountdown}
          disabled={!ready || count !== null || !!camError}
        >
          {count !== null ? "…" : "📸 3 · 2 · 1"}
        </Button>
      )}
    </div>
  );
}
