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

/** Where a photo comes from: the live camera, or files already on the device. */
export type BoothSource = "camera" | "upload";

/**
 * The booth stage: the chosen frame template overlays a LIVE camera preview —
 * the camera shows through the current photo window, already-taken photos sit
 * in theirs, and a thumbnail carousel swaps frames on the fly. Capture runs
 * 3-2-1 → flash → still preview in the window → Keep / Retake.
 *
 * The frame can also be filled WITHOUT the camera: switch the source to
 * 🖼️ Galeri and pick photos from the gallery / files. One photo goes through
 * the same Keep / Retake review; picking several at once fills the remaining
 * windows top→bottom. Picked photos are centre-cropped to the window's aspect
 * exactly like a capture, so both sources feed the same strip composer.
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
  initialSource = "camera",
  onSourceChange,
  allowUpload = true,
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
  /** The slot the camera (or the picker) currently occupies (null = neither). */
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
  /** Start on the camera (default) or straight on the gallery picker. */
  initialSource?: BoothSource;
  onSourceChange?: (source: BoothSource) => void;
  /** Set false to hide the gallery option entirely. */
  allowUpload?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [pending, setPending] = useState<{ slot: number; blob: Blob; dataUrl: string } | null>(null);
  const [keeping, setKeeping] = useState(false);
  const [source, setSource] = useState<BoothSource>(initialSource);
  const [pickError, setPickError] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);

  const uploading = allowUpload && source === "upload";
  const wantCamera = currentSlot !== null && !cameraOff && !uploading;

  function switchSource(next: BoothSource) {
    if (next === source) return;
    setSource(next);
    setPickError(null);
    setCount(null);
    onSourceChange?.(next);
  }

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
      setCamError(
        "Kameranya belum bisa dipakai. Izinkan akses kamera di browser, atau pakai foto dari galeri.",
      );
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

  // The <video> element unmounts while a shot is pending (Keep/Retake) and can
  // be recreated on a frame swap — re-attach the live stream every time it
  // (re)appears, or the viewfinder comes back black.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      void el.play().catch(() => undefined);
    }
  }, []);

  // A pending shot for a slot that no longer exists (frame swapped) is void.
  const pendingShot = pending && pending.slot < template.slots.length ? pending : null;

  /** My still-empty windows (partner windows never count), current one first. */
  const openSlots = template.slots
    .map((_, i) => i)
    .filter((i) => !photos[i] && !placeholderSlots.includes(i) && !placeholderDone.includes(i));
  const fillTargets =
    currentSlot === null ? openSlots : [currentSlot, ...openSlots.filter((i) => i !== currentSlot)];

  function capture(slot: number) {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      // Stream died somewhere along the way — bring the camera back.
      void startCamera();
      return;
    }
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

  function openPicker() {
    setPickError(null);
    fileRef.current?.click();
  }

  /**
   * One picked photo goes to the Keep/Retake review, exactly like a capture.
   * Several at once fill the remaining windows straight away (top→bottom) —
   * any of them can still be replaced afterwards by tapping it.
   */
  async function handlePicked(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length || !fillTargets.length) return;
    setPickError(null);

    if (files.length === 1) {
      const slot = fillTargets[0];
      try {
        const shot = await fileToShot(files[0], template, slot);
        setPending({ slot, ...shot });
      } catch {
        setPickError("Fotonya belum bisa dibaca. Coba foto lain (JPG / PNG) ya. ♡");
      }
      return;
    }

    setFilling(true);
    let failed = 0;
    try {
      for (let n = 0; n < files.length && n < fillTargets.length; n++) {
        const slot = fillTargets[n];
        try {
          const shot = await fileToShot(files[n], template, slot);
          await onKeep(slot, shot.blob, shot.dataUrl);
        } catch {
          failed += 1;
        }
      }
      if (failed) {
        setPickError(
          failed === files.length
            ? "Foto-fotonya belum bisa dibaca. Coba yang format JPG / PNG ya. ♡"
            : `${failed} foto tidak bisa dipakai — sisanya sudah masuk. ♡`,
        );
      }
    } finally {
      setFilling(false);
    }
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

  const showSourceToggle = allowUpload && !previewOnly && currentSlot !== null;
  const emptyPickSlot =
    uploading && currentSlot !== null && !pendingShot && !photos[currentSlot] ? currentSlot : null;

  return (
    <div className="flex flex-col items-center gap-4">
      {showSourceToggle ? (
        <div
          className="inline-flex rounded-full border border-rule bg-paper p-0.5 font-mono text-[11px] tracking-wide"
          role="group"
          aria-label="Sumber foto"
        >
          {(
            [
              ["camera", "📸 Kamera"],
              ["upload", "🖼️ Galeri"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={source === value}
              onClick={() => switchSource(value)}
              className={cn(
                "rounded-full px-3 py-1.5 transition",
                source === value ? "bg-blush/50 text-accent-ink" : "text-ink-faint hover:text-ink-soft",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

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
          if (emptyPickSlot === i) {
            return (
              <div
                key={i}
                className="absolute z-10 flex flex-col items-center justify-center gap-0.5 bg-paper text-accent-ink"
                style={slotStyle(template, i)}
              >
                <span className="text-2xl leading-none">＋</span>
                <span className="font-mono text-[10px] tracking-wide">pilih foto</span>
              </div>
            );
          }
          return null;
        })}

        {wantCamera && currentSlot !== null && !pendingShot ? (
          <video
            ref={attachVideo}
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

        {/* tap the empty window to pick a photo for it */}
        {emptyPickSlot !== null ? (
          <button
            type="button"
            aria-label={`Pilih foto untuk bagian ${emptyPickSlot + 1}`}
            onClick={openPicker}
            disabled={filling}
            className="absolute z-30 rounded-lg"
            style={slotStyle(template, emptyPickSlot)}
          />
        ) : null}

        {/* tap a filled own slot to retake it */}
        {onRetakeSlot
          ? template.slots.map((_, i) =>
              photos[i] && !pendingShot ? (
                <button
                  key={`r${i}`}
                  type="button"
                  aria-label={`Ganti foto bagian ${i + 1}`}
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
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" variant="soft" size="sm" onClick={startCamera}>
                Coba lagi
              </Button>
              {allowUpload && !previewOnly ? (
                <Button type="button" size="sm" onClick={() => switchSource("upload")}>
                  🖼️ Pakai galeri
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* the picker itself — gallery / files, no camera involved */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void handlePicked(e.target.files);
          e.target.value = "";
        }}
      />

      {/* shutter / picker / keep–retake */}
      {pendingShot ? (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={keep} disabled={keeping}>
            {keeping ? "Menyimpan…" : keepLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPending(null)} disabled={keeping}>
            {uploading ? "↻ Pilih lain" : "↻ Retake"}
          </Button>
        </div>
      ) : uploading && currentSlot !== null && !previewOnly ? (
        <div className="flex flex-col items-center gap-1.5">
          <Button type="button" onClick={openPicker} disabled={filling}>
            {filling ? "Memasukkan…" : "🖼️ Pilih dari galeri"}
          </Button>
          {fillTargets.length > 1 ? (
            <p className="text-xs text-ink-faint">
              Bisa pilih {fillTargets.length} foto sekaligus — langsung terisi semua. ♡
            </p>
          ) : null}
        </div>
      ) : wantCamera && currentSlot !== null && !previewOnly ? (
        <Button type="button" onClick={startCountdown} disabled={!ready || count !== null || !!camError}>
          {count !== null ? "…" : "📸 3 · 2 · 1"}
        </Button>
      ) : null}

      {pickError ? (
        <p role="alert" className="text-center text-sm text-danger">
          {pickError}
        </p>
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

// ---- picked files → the same shape a capture produces --------------------------

type Picked = { img: CanvasImageSource; w: number; h: number; release: () => void };

/** Centre-crops a picked file into the slot's aspect at capture resolution. */
async function fileToShot(
  file: File,
  template: BoothTemplate,
  slot: number,
): Promise<{ blob: Blob; dataUrl: string }> {
  const s = template.slots[slot];
  const aspect = (s.w * template.w) / (s.h * template.h);
  const outW = aspect >= 1 ? CAPTURE_MAX : Math.round(CAPTURE_MAX * aspect);
  const outH = aspect >= 1 ? Math.round(CAPTURE_MAX / aspect) : CAPTURE_MAX;

  const picked = await decodePicked(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");

    // Not mirrored — a photo from the gallery is already the right way round.
    let sw = picked.w, sh = picked.h;
    if (sw / sh > aspect) sw = sh * aspect;
    else sh = sw / aspect;
    ctx.drawImage(picked.img, (picked.w - sw) / 2, (picked.h - sh) / 2, sw, sh, 0, 0, outW, outH);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not read the photo"))),
        "image/jpeg",
        0.88,
      );
    });
    return { blob, dataUrl };
  } finally {
    picked.release();
  }
}

/** Decodes honouring EXIF rotation, so phone photos never land sideways. */
async function decodePicked(file: File): Promise<Picked> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { img: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() };
    } catch {
      // Older Safari / odd formats fall through to the <img> decoder.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode the photo"));
      el.src = url;
    });
    return {
      img,
      w: img.naturalWidth,
      h: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}
