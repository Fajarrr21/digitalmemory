import { describe, expect, it } from "vitest";
import {
  MAX_ADJUST_ZOOM,
  centredView,
  clampOffset,
  coverBase,
  pannedView,
  viewScale,
  zoomedView,
  type AdjustView,
  type PhotoSize,
} from "./booth-adjust";

/** A portrait window (a typical strip slot) and a landscape phone photo. */
const WIN = { outW: 600, outH: 800 };
const LANDSCAPE: PhotoSize = { w: 4000, h: 3000 };
const PORTRAIT: PhotoSize = { w: 1080, h: 1920 };

/** The window is covered when the photo's edges sit at or outside it. */
function covers(view: AdjustView, src: PhotoSize, outW: number, outH: number) {
  const scale = viewScale(view, src, outW, outH);
  return (
    view.off.x <= 1e-9 &&
    view.off.y <= 1e-9 &&
    view.off.x + src.w * scale >= outW - 1e-9 &&
    view.off.y + src.h * scale >= outH - 1e-9
  );
}

describe("coverBase", () => {
  it("scales a landscape photo to the window's height", () => {
    // 800/3000 is the binding side; the width then overflows, which is the point.
    expect(coverBase(LANDSCAPE, WIN.outW, WIN.outH)).toBeCloseTo(800 / 3000);
  });

  it("scales a portrait photo to the window's width", () => {
    expect(coverBase(PORTRAIT, WIN.outW, WIN.outH)).toBeCloseTo(600 / 1080);
  });
});

describe("centredView", () => {
  it("fills the window with the middle of the photo", () => {
    const view = centredView(LANDSCAPE, WIN.outW, WIN.outH);
    expect(view.zoom).toBe(1);
    expect(view.off.y).toBeCloseTo(0); // the binding side sits flush
    const scale = coverBase(LANDSCAPE, WIN.outW, WIN.outH);
    expect(view.off.x).toBeCloseTo((WIN.outW - LANDSCAPE.w * scale) / 2);
    expect(covers(view, LANDSCAPE, WIN.outW, WIN.outH)).toBe(true);
  });

  it("leaves no gap for either orientation", () => {
    for (const src of [LANDSCAPE, PORTRAIT, { w: 1000, h: 1000 }]) {
      expect(covers(centredView(src, WIN.outW, WIN.outH), src, WIN.outW, WIN.outH)).toBe(true);
    }
  });
});

describe("clampOffset", () => {
  it("never lets the photo slide off the window", () => {
    const scale = coverBase(LANDSCAPE, WIN.outW, WIN.outH);
    const far = clampOffset({ x: 5000, y: -9000 }, LANDSCAPE, WIN.outW, WIN.outH, scale);
    expect(far.x).toBe(0);
    expect(far.y).toBeCloseTo(WIN.outH - LANDSCAPE.h * scale);
    expect(covers({ zoom: 1, off: far }, LANDSCAPE, WIN.outW, WIN.outH)).toBe(true);
  });
});

describe("pannedView", () => {
  it("moves the photo by the drag delta", () => {
    const start = centredView(LANDSCAPE, WIN.outW, WIN.outH);
    const moved = pannedView(start, LANDSCAPE, WIN.outW, WIN.outH, -50, 0);
    expect(moved.off.x).toBeCloseTo(start.off.x - 50);
    expect(moved.zoom).toBe(start.zoom);
  });

  it("stops at the edge instead of revealing a gap", () => {
    const start = centredView(LANDSCAPE, WIN.outW, WIN.outH);
    const dragged = pannedView(start, LANDSCAPE, WIN.outW, WIN.outH, 99999, 99999);
    expect(dragged.off).toEqual({ x: 0, y: 0 });
    expect(covers(dragged, LANDSCAPE, WIN.outW, WIN.outH)).toBe(true);
  });

  it("can reach both ends of a photo that overflows one axis", () => {
    const start = centredView(PORTRAIT, WIN.outW, WIN.outH);
    const scale = coverBase(PORTRAIT, WIN.outW, WIN.outH);
    const toTop = pannedView(start, PORTRAIT, WIN.outW, WIN.outH, 0, 99999);
    const toBottom = pannedView(start, PORTRAIT, WIN.outW, WIN.outH, 0, -99999);
    expect(toTop.off.y).toBeCloseTo(0);
    expect(toBottom.off.y).toBeCloseTo(WIN.outH - PORTRAIT.h * scale);
  });
});

describe("zoomedView", () => {
  it("keeps the anchored point of the photo under the anchor", () => {
    const start = centredView(LANDSCAPE, WIN.outW, WIN.outH);
    const anchor = { x: 200, y: 300 };
    const startScale = viewScale(start, LANDSCAPE, WIN.outW, WIN.outH);
    // Which photo pixel sits under the anchor before the zoom…
    const px = (anchor.x - start.off.x) / startScale;
    const py = (anchor.y - start.off.y) / startScale;

    const zoomedIn = zoomedView(start, LANDSCAPE, WIN.outW, WIN.outH, 2, anchor);
    const nextScale = viewScale(zoomedIn, LANDSCAPE, WIN.outW, WIN.outH);
    // …is still under it afterwards.
    expect(zoomedIn.off.x + px * nextScale).toBeCloseTo(anchor.x);
    expect(zoomedIn.off.y + py * nextScale).toBeCloseTo(anchor.y);
    expect(zoomedIn.zoom).toBe(2);
  });

  it("refuses to shrink below filling the window", () => {
    const start = centredView(LANDSCAPE, WIN.outW, WIN.outH);
    const out = zoomedView(start, LANDSCAPE, WIN.outW, WIN.outH, 0.2, { x: 300, y: 400 });
    expect(out.zoom).toBe(1);
    expect(covers(out, LANDSCAPE, WIN.outW, WIN.outH)).toBe(true);
  });

  it("caps how far it zooms in", () => {
    const start = centredView(PORTRAIT, WIN.outW, WIN.outH);
    const out = zoomedView(start, PORTRAIT, WIN.outW, WIN.outH, 99, { x: 0, y: 0 });
    expect(out.zoom).toBe(MAX_ADJUST_ZOOM);
  });

  it("stays gap-free through a pinch-and-drag session", () => {
    let view = centredView(PORTRAIT, WIN.outW, WIN.outH);
    const steps: Array<[number, number, number]> = [
      [1.4, 600, 800],
      [2.6, 0, 0],
      [1.0, 300, 400],
      [3.9, 600, 0],
    ];
    for (const [zoom, ax, ay] of steps) {
      view = zoomedView(view, PORTRAIT, WIN.outW, WIN.outH, zoom, { x: ax, y: ay });
      expect(covers(view, PORTRAIT, WIN.outW, WIN.outH)).toBe(true);
      view = pannedView(view, PORTRAIT, WIN.outW, WIN.outH, 250, -400);
      expect(covers(view, PORTRAIT, WIN.outW, WIN.outH)).toBe(true);
    }
  });

  it("zooming out all the way returns to a full-window fit", () => {
    let view = centredView(LANDSCAPE, WIN.outW, WIN.outH);
    view = zoomedView(view, LANDSCAPE, WIN.outW, WIN.outH, 3, { x: 0, y: 0 });
    view = pannedView(view, LANDSCAPE, WIN.outW, WIN.outH, -500, -500);
    view = zoomedView(view, LANDSCAPE, WIN.outW, WIN.outH, 1, { x: 300, y: 400 });
    expect(view.zoom).toBe(1);
    expect(covers(view, LANDSCAPE, WIN.outW, WIN.outH)).toBe(true);
  });
});
