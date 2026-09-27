"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CAPTURE_MAX,
  COUNTDOWN_FROM,
  templateSrc,
  templateThumb,
  type BoothTemplate,
} from "./photobooth-config";

/**
 * The booth stage: the chosen frame template overlays a LIVE camera preview —
 * the camera shows through the current photo window, already-taken photos sit
 * in theirs, and a thumbnail carousel swaps frames on the fly. Capture runs
 * 3-2-1 → flash → still preview in the window → Keep / Retake.
 *
 * The template webp has transparent windows and is drawn on top (z-20);
 * video/photos live underneath (z-10), so every window clips itself.
 */
export function BoothStage({
  template,
  templates,
  onTemplateChange,
  photos,
  placeholderSlots = [],
  placeholderDone = [],
  currentSlot,
  prompt = null,
  keepLabel = "✓ Keep",
  onKeep,
  onRetakeSlot,
  footer,
  cameraOff = false,
  previewOnly = false,
}: {
  template: BoothTemplate;
  /** Carousel choices; omit to hide the carousel. */
  templates?: BoothTemplate[];
  onTemplateChange?: (id: string) => void;
  /** Filled slot → image src (data URL / signed URL). */
  photos: Record<number, string>;
  /** Partner slots still coming (soft ♡ paper). */
  placeholderSlots?: number[];
  /** Partner slots already filled but kept secret until the reveal. */
  placeholderDone?: number[];
  /** The slot the camera currently occupies (null = no camera). */
  currentSlot: number | null;
  prompt?: string | null;
  keepLabel?: string;
  onKeep: (slot: number, blob: Blob, dataUrl: string) => void | Promise<void>;
  /** Tap one of your filled slots to retake it. */
  onRetakeSlot?: (slot: number) => void;
  footer?: React.ReactNode;
  /** True while the camera isn't needed (e.g. waiting for the partner). */
  cameraOff?: boolean;
  /** Live camera through the frame, but no shutter (lobby preview). */
  previewOnly?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [pending, setPending] = useState<{ slot: number; blob: Blob; dataUrl: string } | null>(null);
  const [keeping, setKeeping] = useState(false);

  const wantCamera = currentSlot !== null && !cameraOff;

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
    if (!wantCamera) return;
    // Deferred so the permission prompt never blocks the first paint.
    const t = setTimeout(() => void startCamera(), 0);
    return () => {
      clearTimeout(t);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [startCamera, wantCamera]);

  // A pending shot for a slot that no longer exists (frame swapped) is void.
  const pendingShot = pending && pending.slot < template.slots.length ? pending : null;

  function capture(slot: number) {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const s = template.slots[slot];
    const aspect = (s.w * template.w) / (s.h * template.h);

    const outW = aspect >= 1 ? CAPTURE_MAX : Math.round(CAPTURE_MAX * aspect);
    const outH = aspect >= 1 ? Math.round(CAPTURE_MAX / aspect) : CAPTURE_MAX;

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Centre-crop the feed to the slot's aspect, mirrored like the preview.
    let sw = video.videoWidth, sh = video.videoHeight;
    if (sw / sh > aspect) sw = sh * aspect;
    else sh = sw / aspect;
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);

    canvas.toBlob(
      (blob) => {
        if (blob) setPending({ slot, blob, dataUrl: canvas.toDataURL("image/jpeg", 0.85) });
      },
      "image/jpeg",
      0.88,
    );
  }

  function startCountdown() {
    if (currentSlot === null) return;
    const slot = currentSlot;
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
        capture(slot);
        setTimeout(() => setFlash(false), 260);
      }
    };
    setTimeout(tick, 1000);
  }

  async function keep() {
    if (!pendingShot) return;
    setKeeping(true);
    try {
      await onKeep(pendingShot.slot, pendingShot.blob, pendingShot.dataUrl);
      setPending(null);
    } finally {
      setKeeping(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {prompt ? <p className="text-center font-hand text-2xl text-accent-ink">{prompt}</p> : null}

      {/* the stage */}
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-paper-2 shadow-[var(--shadow-soft)]"
        style={{ aspectRatio: `${template.w} / ${template.h}` }}
      >
        {/* photos + placeholders + live camera, all UNDER the frame */}
        {template.slots.map((_, i) => {
          const isPendingHere = pendingShot?.slot === i;
          if (isPendingHere) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={pendingShot!.dataUrl} alt="" className="absolute z-10 object-cover" style={slotStyle(template, i)} />
            );
          }
          if (photos[i]) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={photos[i]} alt="" className="absolute z-10 object-cover" style={slotStyle(template, i)} />
            );
          }
          if (placeholderDone.includes(i)) {
            return (
              <div key={i} className="absolute z-10 flex items-center justify-center bg-blush/50" style={slotStyle(template, i)}>
                <span className="text-lg">🤫</span>
              </div>
            );
          }
          if (placeholderSlots.includes(i)) {
            return (
              <div key={i} className="absolute z-10 flex items-center justify-center bg-paper" style={slotStyle(template, i)}>
                <span className="text-lg opacity-40">♡</span>
              </div>
            );
          }
          return null;
        })}

        {wantCamera && currentSlot !== null && !pendingShot ? (
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute z-10 -scale-x-100 object-cover"
            style={slotStyle(template, currentSlot)}
          />
        ) : null}

        {/* the frame itself */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={templateSrc(template.id)}
          alt=""
          className="pointer-events-none absolute inset-0 z-20 h-full w-full"
          draggable={false}
        />

        {/* tap a filled own slot to retake it */}
        {onRetakeSlot
          ? template.slots.map((_, i) =>
              photos[i] && !pendingShot ? (
                <button
                  key={`r${i}`}
                  type="button"
                  aria-label={`Foto ulang bagian ${i + 1}`}
                  onClick={() => onRetakeSlot(i)}
                  className="absolute z-30 rounded-lg"
                  style={slotStyle(template, i)}
                />
              ) : null,
            )
          : null}

        {/* countdown over the active window */}
        {count !== null && currentSlot !== null ? (
          <div
            className="pointer-events-none absolute z-30 flex items-center justify-center"
            style={slotStyle(template, currentSlot)}
          >
            <motion.span
              key={count}
              initial={{ scale: 1.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display text-6xl font-semibold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
            >
              {count}
            </motion.span>
          </div>
        ) : null}

        {flash ? <div className="absolute inset-0 z-40 bg-white" /> : null}

        {camError && wantCamera ? (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-ground/80 px-6 text-center backdrop-blur-sm">
            <p className="text-sm text-ink-soft">{camError}</p>
            <Button type="button" variant="soft" size="sm" onClick={startCamera}>
              Coba lagi
            </Button>
          </div>
        ) : null}
      </div>

      {/* shutter / keep–retake */}
      {pendingShot ? (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={keep} disabled={keeping}>
            {keeping ? "Menyimpan…" : keepLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPending(null)} disabled={keeping}>
            ↻ Retake
          </Button>
        </div>
      ) : wantCamera && currentSlot !== null && !previewOnly ? (
        <Button type="button" onClick={startCountdown} disabled={!ready || count !== null || !!camError}>
          {count !== null ? "…" : "📸 3 · 2 · 1"}
        </Button>
      ) : null}

      {footer}

      {/* frame carousel */}
      {templates && onTemplateChange ? (
        <div className="w-full max-w-sm">
          <p className="mb-1.5 text-center font-mono text-[11px] tracking-wide text-ink-faint">
            choose a frame — geser ➜
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2" role="listbox" aria-label="Pilih frame">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={t.id === template.id}
                onClick={() => onTemplateChange(t.id)}
                title={t.name}
                className={cn(
                  "relative flex-none overflow-hidden rounded-lg border-2 transition",
                  t.id === template.id
                    ? "border-accent-ink"
                    : "border-transparent opacity-80 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={templateThumb(t.id)} alt={t.name} className="h-24 w-auto" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function slotStyle(template: BoothTemplate, i: number): React.CSSProperties {
  const s = template.slots[i];
  return {
    left: `${s.x * 100}%`,
    top: `${s.y * 100}%`,
    width: `${s.w * 100}%`,
    height: `${s.h * 100}%`,
  };
}
