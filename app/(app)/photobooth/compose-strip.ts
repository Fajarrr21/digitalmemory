"use client";

import { templateSrc, type BoothTemplate } from "./photobooth-config";

/**
 * Composes the finished strip: photos drawn BEHIND the template image, which
 * has transparent photo windows — so window shapes clip the photos exactly
 * and decorations that overlap a window stay on top.
 *
 * Export height is story-friendly (1920px tall); width follows the template's
 * own aspect so no window is ever cropped away.
 */

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

export async function composeBoothImage({
  template,
  photos,
}: {
  template: BoothTemplate;
  /** Photo source per slot index (data URL, blob URL, or signed URL). */
  photos: Record<number, string>;
}): Promise<Blob> {
  const H = 1920;
  const W = Math.round((H * template.w) / template.h);

  const frameImg = await loadImage(templateSrc(template.id));
  const slotImgs = await Promise.all(
    template.slots.map((_, i) => (photos[i] ? loadImage(photos[i]) : Promise.resolve(null))),
  );

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  // Photos first (behind), cover-fit into each slot bbox.
  template.slots.forEach((s, i) => {
    const img = slotImgs[i];
    if (!img) return;
    const dx = s.x * W, dy = s.y * H, dw = s.w * W, dh = s.h * H;
    const scale = Math.max(dw / img.width, dh / img.height);
    const sw = dw / scale, sh = dh / scale;
    const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  });

  // The frame on top — its punched windows reveal the photos.
  ctx.drawImage(frameImg, 0, 0, W, H);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not export the strip"))), "image/png");
  });
}

/** Hand the strip to the OS share sheet; fall back to a plain download. */
export async function shareBoothImage(blob: Blob, filename: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "A Little Photo Booth" });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Signed Supabase URLs allow CORS; without this the canvas would taint.
    if (!src.startsWith("data:") && !src.startsWith("blob:") && !src.startsWith("/")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load a photo"));
    img.src = src;
  });
}
