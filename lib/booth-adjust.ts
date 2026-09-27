/**
 * Photo Booth — the geometry behind the IG-story-style photo adjuster.
 *
 * A picked photo sits inside one window of the frame. Everything here works in
 * the window's own pixel space (its export size): `off` is the photo's top-left
 * corner relative to the window, `zoom` is 1 when the photo exactly covers the
 * window. The photo may never be smaller than the window and may never be
 * dragged past its edges, so a kept photo can't leave a gap in the frame.
 *
 * Pure functions, unit-tested in booth-adjust.test.ts — the component only
 * turns pointer events into calls on these.
 */

/** How far a picked photo may be zoomed in. */
export const MAX_ADJUST_ZOOM = 4;

export type PhotoSize = { w: number; h: number };
export type Offset = { x: number; y: number };
/** Where the photo sits in the window: zoom (1 = fills it) + top-left offset. */
export type AdjustView = { zoom: number; off: Offset };

/** Scale at which the photo exactly covers the window. */
export function coverBase(src: PhotoSize, outW: number, outH: number): number {
  return Math.max(outW / src.w, outH / src.h);
}

/** The photo's on-screen scale for a view. */
export function viewScale(view: AdjustView, src: PhotoSize, outW: number, outH: number): number {
  return coverBase(src, outW, outH) * view.zoom;
}

/** Keeps the window fully covered — no gaps, whatever a drag or pinch asks. */
export function clampOffset(
  off: Offset,
  src: PhotoSize,
  outW: number,
  outH: number,
  scale: number,
): Offset {
  return {
    x: Math.min(0, Math.max(outW - src.w * scale, off.x)),
    y: Math.min(0, Math.max(outH - src.h * scale, off.y)),
  };
}

/** Cover-fitted and centred — the same framing a plain centre-crop gives. */
export function centredView(src: PhotoSize, outW: number, outH: number): AdjustView {
  const scale = coverBase(src, outW, outH);
  return { zoom: 1, off: { x: (outW - src.w * scale) / 2, y: (outH - src.h * scale) / 2 } };
}

/** Drag: move the photo by a delta in window px. */
export function pannedView(
  view: AdjustView,
  src: PhotoSize,
  outW: number,
  outH: number,
  dx: number,
  dy: number,
): AdjustView {
  const scale = viewScale(view, src, outW, outH);
  return {
    zoom: view.zoom,
    off: clampOffset({ x: view.off.x + dx, y: view.off.y + dy }, src, outW, outH, scale),
  };
}

/**
 * Pinch / slider / wheel: zoom to `nextZoom` while the point of the photo under
 * `anchor` (window px) stays where it is. Zoom is clamped to [1, MAX].
 */
export function zoomedView(
  view: AdjustView,
  src: PhotoSize,
  outW: number,
  outH: number,
  nextZoom: number,
  anchor: Offset,
): AdjustView {
  const zoom = Math.min(MAX_ADJUST_ZOOM, Math.max(1, nextZoom));
  const base = coverBase(src, outW, outH);
  const oldScale = base * view.zoom;
  const newScale = base * zoom;
  const off = {
    x: anchor.x - ((anchor.x - view.off.x) / oldScale) * newScale,
    y: anchor.y - ((anchor.y - view.off.y) / oldScale) * newScale,
  };
  return { zoom, off: clampOffset(off, src, outW, outH, newScale) };
}
