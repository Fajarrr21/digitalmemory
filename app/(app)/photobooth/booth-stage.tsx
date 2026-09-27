"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAX_ADJUST_ZOOM,
  centredView,
  coverBase,
  pannedView,
  zoomedView,
  type AdjustView,
} from "@/lib/booth-adjust";
import {
  CAPTURE_MAX,
  COUNTDOWN_FROM,
  templateSrc,
  templateThumb,
  type BoothTemplate,
} from "./photobooth-config";

/** Where a photo comes from: the live camera, or files already on the device. */
export type BoothSource = "camera" | "upload";

/** Longest side a picked photo is kept at while it's being adjusted, px. */
const WORK_MAX = 2000;

/**
 * The booth stage: the chosen frame template overlays a LIVE camera preview —
 * the camera shows through the current photo window, already-taken photos sit
 * in theirs, and a thumbnail carousel swaps frames on the fly. Capture runs
 * 3-2-1 → flash → still preview in the window → Keep / Retake.
 *
 * The frame can also be filled WITHOUT the camera: switch the source to
 * 🖼️ Galeri and pick photos from the gallery / files. A picked photo lands in
 * the window as an IG-story-style adjuster — drag to move, pinch (or slider /
 * wheel) to zoom, right inside the real frame, so you see exactly what you
 * keep. It can never be shrunk past filling the window, so no gaps. Picking
 * several photos at once fills the remaining windows cover-fitted; tapping any
 * of them re-opens its adjuster with the original photo.
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [pending, setPending] = useState<{ slot: number; blob: Blob; dataUrl: string } | null>(null);
  const [keeping, setKeeping] = useState(false);
  const [source, setSource] = useState<BoothSource>(initialSource);
  const [pickError, setPickError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [adjustState, setAdjust] = useState<Adjust | null>(null);
  const [stageW, setStageW] = useState(0);

  /** Every picked photo we still hold, per slot, so it can be re-adjusted. */
  const sources = useRef<Map<number, Working>>(new Map());
  /** Which frame those belong to — windows don't carry over to another frame. */
  const heldFrame = useRef(template.id);
  /** Which slots that covers — mirrored in state, since the render reads it. */
  const [heldSlots, setHeldSlots] = useState<number[]>([]);
  /** The pan/zoom last kept for a slot, restored when it's re-opened. */
  const views = useRef<Map<number, AdjustView>>(new Map());

  /** A picked photo belongs to the frame it was placed in — a swap voids it. */
  const adjust = adjustState && adjustState.templateId === template.id ? adjustState : null;

  const uploading = allowUpload && source === "upload";
  const wantCamera = currentSlot !== null && !cameraOff && !uploading && !adjust;

  function switchSource(next: BoothSource) {
    if (next === source) return;
    setSource(next);
    setPickError(null);
    setCount(null);
    if (next === "camera") setAdjust(null);
    onSourceChange?.(next);
  }

  // ---- camera ---------------------------------------------------------------
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

  // ---- stage size: the bridge between screen px and export px ---------------
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    setStageW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => setStageW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Nothing leaks when the booth closes.
  useEffect(() => {
    const held = sources.current;
    return () => {
      for (const w of held.values()) URL.revokeObjectURL(w.url);
      held.clear();
    };
  }, []);

  // A pending shot for a slot that no longer exists (frame swapped) is void.
  const pendingShot = pending && pending.slot < template.slots.length ? pending : null;

  /** My still-empty windows (partner windows never count), current one first. */
  const openSlots = template.slots
    .map((_, i) => i)
    .filter((i) => !photos[i] && !placeholderSlots.includes(i) && !placeholderDone.includes(i));
  const leadSlot = adjust ? adjust.slot : currentSlot;
  const fillTargets =
    leadSlot === null ? openSlots : [leadSlot, ...openSlots.filter((i) => i !== leadSlot)];

  // ---- capture --------------------------------------------------------------
  function capture(slot: number) {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      // Stream died somewhere along the way — bring the camera back.
      void startCamera();
      return;
    }
    const { outW, outH, aspect } = slotOut(template, slot);

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

  // ---- picking & adjusting --------------------------------------------------
  function openPicker() {
    setPickError(null);
    fileRef.current?.click();
  }

  /** Drops every photo we hold (a different frame, or the booth is done). */
  function releaseHeld() {
    for (const w of sources.current.values()) URL.revokeObjectURL(w.url);
    sources.current.clear();
    views.current.clear();
    setHeldSlots([]);
  }

  function holdSource(slot: number, working: Working) {
    if (heldFrame.current !== template.id) {
      releaseHeld();
      heldFrame.current = template.id;
    }
    const old = sources.current.get(slot);
    if (old && old.url !== working.url) URL.revokeObjectURL(old.url);
    sources.current.set(slot, working);
    setHeldSlots((prev) => (prev.includes(slot) ? prev : [...prev, slot]));
  }

  /** Open the adjuster on a photo we already hold for this slot. */
  function reopenAdjust(slot: number) {
    const working = heldFrame.current === template.id ? sources.current.get(slot) : undefined;
    if (!working) return false;
    const { outW, outH } = slotOut(template, slot);
    setPickError(null);
    setAdjust({
      slot,
      templateId: template.id,
      src: working,
      ...(views.current.get(slot) ?? centredView(working, outW, outH)),
    });
    return true;
  }

  /**
   * One picked photo opens the adjuster, so it can be moved and zoomed inside
   * the window before it's kept. Several at once fill the remaining windows
   * cover-fitted straight away — each can still be adjusted by tapping it.
   */
  async function handlePicked(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length || !fillTargets.length) return;
    setPickError(null);
    setPreparing(true);
    try {
      if (files.length === 1) {
        const slot = fillTargets[0];
        const { outW, outH } = slotOut(template, slot);
        try {
          const working = await prepareWorking(files[0]);
          holdSource(slot, working);
          const view = centredView(working, outW, outH);
          views.current.set(slot, view);
          setAdjust({ slot, templateId: template.id, src: working, ...view });
        } catch {
          setPickError("Fotonya belum bisa dibaca. Coba foto lain (JPG / PNG) ya. ♡");
        }
        return;
      }

      setAdjust(null);
      let failed = 0;
      for (let n = 0; n < files.length && n < fillTargets.length; n++) {
        const slot = fillTargets[n];
        const { outW, outH } = slotOut(template, slot);
        try {
          const working = await prepareWorking(files[n]);
          holdSource(slot, working);
          const view = centredView(working, outW, outH);
          views.current.set(slot, view);
          const shot = await bakeShot(working, view, outW, outH);
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
      setPreparing(false);
    }
  }

  /** px on screen per export px, for the window being adjusted. */
  const adjustK =
    adjust && stageW > 0
      ? (template.slots[adjust.slot].w * stageW) / slotOut(template, adjust.slot).outW
      : 0;

  function panBy(dx: number, dy: number) {
    setAdjust((a) => {
      if (!a) return a;
      const { outW, outH } = slotOut(template, a.slot);
      return { ...a, ...pannedView(a, a.src, outW, outH, dx, dy) };
    });
  }

  /** Zoom to an absolute level, keeping `anchor` (window px) in place. */
  const zoomTo = useCallback(
    (nextZoom: number, anchor: { x: number; y: number }) => {
      setAdjust((a) => (a ? zoomed(a, nextZoom, anchor, template) : a));
    },
    [template],
  );

  /** The same, relative — pinch and wheel never need to read the current zoom. */
  const zoomBy = useCallback(
    (factor: number, anchor: { x: number; y: number }) => {
      setAdjust((a) => (a ? zoomed(a, a.zoom * factor, anchor, template) : a));
    },
    [template],
  );

  function recentre() {
    setAdjust((a) => {
      if (!a) return a;
      const { outW, outH } = slotOut(template, a.slot);
      return { ...a, ...centredView(a.src, outW, outH) };
    });
  }

  // ---- adjust gestures: drag to pan, two fingers to pinch -------------------
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);

  function gestureDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = ptrs.current.size >= 2 ? pinchOf(ptrs.current) : null;
  }

  function gestureMove(e: React.PointerEvent<HTMLDivElement>) {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev || !adjust || adjustK <= 0) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrs.current.size === 1) {
      panBy((e.clientX - prev.x) / adjustK, (e.clientY - prev.y) / adjustK);
      return;
    }
    const now = pinchOf(ptrs.current);
    const was = pinch.current;
    pinch.current = now;
    if (!was || was.dist <= 0 || now.dist <= 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    zoomBy(now.dist / was.dist, {
      x: (was.mid.x - rect.left) / adjustK,
      y: (was.mid.y - rect.top) / adjustK,
    });
    panBy((now.mid.x - was.mid.x) / adjustK, (now.mid.y - was.mid.y) / adjustK);
  }

  function gestureUp(e: React.PointerEvent<HTMLDivElement>) {
    ptrs.current.delete(e.pointerId);
    pinch.current = ptrs.current.size >= 2 ? pinchOf(ptrs.current) : null;
  }

  // Wheel zoom has to be a native non-passive listener — React's onWheel is
  // passive, so it could never stop the page scrolling underneath.
  const [gestureEl, setGestureEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!gestureEl || adjustK <= 0) return;
    const handle = (e: WheelEvent) => {
      e.preventDefault();
      const rect = gestureEl.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY / 320), {
        x: (e.clientX - rect.left) / adjustK,
        y: (e.clientY - rect.top) / adjustK,
      });
    };
    gestureEl.addEventListener("wheel", handle, { passive: false });
    return () => gestureEl.removeEventListener("wheel", handle);
  }, [gestureEl, adjustK, zoomBy]);

  // ---- keeping --------------------------------------------------------------
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

  async function keepAdjusted() {
    if (!adjust) return;
    setKeeping(true);
    try {
      const { outW, outH } = slotOut(template, adjust.slot);
      const view: AdjustView = { zoom: adjust.zoom, off: adjust.off };
      const shot = await bakeShot(adjust.src, view, outW, outH);
      views.current.set(adjust.slot, view);
      await onKeep(adjust.slot, shot.blob, shot.dataUrl);
      setAdjust(null);
    } catch {
      setPickError("Gagal memakai fotonya. Coba lagi ya. ♡");
    } finally {
      setKeeping(false);
    }
  }

  const showSourceToggle = allowUpload && !previewOnly && (currentSlot !== null || !!adjust);
  const adjustingReady = adjust && stageW > 0 ? adjust : null;
  const emptyPickSlot =
    uploading && !adjust && currentSlot !== null && !pendingShot && !photos[currentSlot]
      ? currentSlot
      : null;
  const tapTargetsOn = !pendingShot && !adjust;

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

      {prompt && !adjust ? (
        <p className="text-center font-hand text-2xl text-accent-ink">{prompt}</p>
      ) : null}

      {/* the stage */}
      <div
        ref={stageRef}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-paper-2 shadow-[var(--shadow-soft)]"
        style={{ aspectRatio: `${template.w} / ${template.h}` }}
      >
        {/* photos + placeholders + live camera, all UNDER the frame */}
        {template.slots.map((_, i) => {
          if (adjustingReady?.slot === i) {
            const { outW, outH } = slotOut(template, i);
            const scale = coverBase(adjustingReady.src, outW, outH) * adjustingReady.zoom;
            return (
              <div key={i} className="absolute z-10 overflow-hidden bg-paper" style={slotStyle(template, i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={adjustingReady.src.url}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute max-w-none select-none"
                  style={{
                    width: adjustingReady.src.w * scale * adjustK,
                    height: adjustingReady.src.h * scale * adjustK,
                    left: adjustingReady.off.x * adjustK,
                    top: adjustingReady.off.y * adjustK,
                  }}
                />
              </div>
            );
          }
          if (pendingShot?.slot === i) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={pendingShot.dataUrl} alt="" className="absolute z-10 object-cover" style={slotStyle(template, i)} />
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

        {/* the adjuster's gesture surface, over its window */}
        {adjustingReady ? (
          <div
            ref={setGestureEl}
            aria-hidden
            className="absolute z-30 cursor-grab touch-none select-none shadow-[inset_0_0_0_2px_rgba(255,255,255,0.75)] active:cursor-grabbing"
            style={slotStyle(template, adjustingReady.slot)}
            onPointerDown={gestureDown}
            onPointerMove={gestureMove}
            onPointerUp={gestureUp}
            onPointerCancel={gestureUp}
          />
        ) : null}

        {/* tap the empty window to pick a photo for it */}
        {emptyPickSlot !== null ? (
          <button
            type="button"
            aria-label={`Pilih foto untuk bagian ${emptyPickSlot + 1}`}
            onClick={openPicker}
            disabled={preparing}
            className="absolute z-30 rounded-lg"
            style={slotStyle(template, emptyPickSlot)}
          />
        ) : null}

        {/* tap one of my filled slots: adjust it again, or retake it */}
        {tapTargetsOn
          ? template.slots.map((_, i) =>
              photos[i] ? (
                <button
                  key={`r${i}`}
                  type="button"
                  aria-label={
                    uploading && heldSlots.includes(i)
                      ? `Atur ulang foto bagian ${i + 1}`
                      : `Ganti foto bagian ${i + 1}`
                  }
                  onClick={() => {
                    if (uploading && reopenAdjust(i)) return;
                    onRetakeSlot?.(i);
                  }}
                  disabled={!onRetakeSlot && !(uploading && heldSlots.includes(i))}
                  className="absolute z-30 rounded-lg disabled:pointer-events-none"
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

      {/* adjuster controls / shutter / picker / keep–retake */}
      {adjust ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-2">
          <p className="text-center text-xs text-ink-faint">
            geser buat mindahin · pinch (atau slider) buat zoom
          </p>
          <div className="flex w-full items-center gap-3 text-sm text-ink-soft">
            <span aria-hidden>－</span>
            <input
              type="range"
              min={100}
              max={MAX_ADJUST_ZOOM * 100}
              value={Math.round(adjust.zoom * 100)}
              onChange={(e) => {
                const { outW, outH } = slotOut(template, adjust.slot);
                zoomTo(Number(e.target.value) / 100, { x: outW / 2, y: outH / 2 });
              }}
              className="w-full accent-[var(--accent)]"
              aria-label="Zoom foto"
            />
            <span aria-hidden>＋</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" onClick={keepAdjusted} disabled={keeping}>
              {keeping ? "Menyimpan…" : keepLabel}
            </Button>
            <Button type="button" variant="ghost" onClick={openPicker} disabled={keeping || preparing}>
              {preparing ? "…" : "↻ Pilih lain"}
            </Button>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button type="button" onClick={recentre} className="text-accent-ink hover:underline">
              ↺ Pas-kan lagi
            </button>
            <button
              type="button"
              onClick={() => setAdjust(null)}
              className="text-ink-faint hover:underline"
            >
              batal
            </button>
          </div>
        </div>
      ) : pendingShot ? (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={keep} disabled={keeping}>
            {keeping ? "Menyimpan…" : keepLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPending(null)} disabled={keeping}>
            ↻ Retake
          </Button>
        </div>
      ) : uploading && currentSlot !== null && !previewOnly ? (
        <div className="flex flex-col items-center gap-1.5">
          <Button type="button" onClick={openPicker} disabled={preparing}>
            {preparing ? "Menyiapkan…" : "🖼️ Pilih dari galeri"}
          </Button>
          <p className="text-center text-xs text-ink-faint">
            {fillTargets.length > 1
              ? `Bisa pilih ${fillTargets.length} foto sekaligus — nanti bisa diatur satu-satu. ♡`
              : "Setelah dipilih, fotonya bisa digeser & di-zoom di dalam frame. ♡"}
          </p>
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
                onClick={() => {
                  if (t.id !== template.id) {
                    // Other windows, other crops — start the picked photos over.
                    setAdjust(null);
                    releaseHeld();
                    heldFrame.current = t.id;
                  }
                  onTemplateChange(t.id);
                }}
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

/** A window's export size in px — also the coordinate space the adjuster uses. */
function slotOut(template: BoothTemplate, slot: number) {
  const s = template.slots[slot];
  const aspect = (s.w * template.w) / (s.h * template.h);
  const outW = aspect >= 1 ? CAPTURE_MAX : Math.round(CAPTURE_MAX * aspect);
  const outH = aspect >= 1 ? Math.round(CAPTURE_MAX / aspect) : CAPTURE_MAX;
  return { outW, outH, aspect };
}

// ---- picked photos: prepare → adjust → bake -------------------------------------

/** A picked photo, orientation already baked out, small enough to keep around. */
type Working = { url: string; img: HTMLImageElement; w: number; h: number };
type Adjust = { slot: number; templateId: string; src: Working } & AdjustView;

/** Zooms a view in place, keeping the window's own pixel space. */
function zoomed(
  a: Adjust,
  nextZoom: number,
  anchor: { x: number; y: number },
  template: BoothTemplate,
): Adjust {
  const { outW, outH } = slotOut(template, a.slot);
  return { ...a, ...zoomedView(a, a.src, outW, outH, nextZoom, anchor) };
}

/**
 * Decodes a picked file into a bounded, EXIF-corrected image we can both show
 * in the window and draw from when it's kept.
 */
async function prepareWorking(file: File): Promise<Working> {
  const picked = await decodePicked(file);
  try {
    const shrink = Math.min(1, WORK_MAX / Math.max(picked.w, picked.h));
    const w = Math.max(1, Math.round(picked.w * shrink));
    const h = Math.max(1, Math.round(picked.h * shrink));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.drawImage(picked.img, 0, 0, w, h);

    const blob = await canvasBlob(canvas, 0.92);
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      return { url, img, w, h };
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  } finally {
    picked.release();
  }
}

/** Renders exactly what the window shows, at the slot's export size. */
async function bakeShot(
  src: Working,
  view: AdjustView,
  outW: number,
  outH: number,
): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  // Not mirrored — a photo from the gallery is already the right way round.
  const scale = coverBase(src, outW, outH) * view.zoom;
  ctx.drawImage(src.img, view.off.x, view.off.y, src.w * scale, src.h * scale);

  return { blob: await canvasBlob(canvas, 0.88), dataUrl: canvas.toDataURL("image/jpeg", 0.85) };
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not read the photo"))),
      "image/jpeg",
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode the photo"));
    el.src = src;
  });
}

type Picked = { img: CanvasImageSource; w: number; h: number; release: () => void };

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
    const img = await loadImage(url);
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

/** Distance + midpoint of the first two active pointers. */
function pinchOf(ptrs: Map<number, { x: number; y: number }>) {
  const [a, b] = [...ptrs.values()];
  return {
    dist: Math.hypot(b.x - a.x, b.y - a.y),
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}
