"use client";

import type { BoothFrame } from "./photobooth-config";

/**
 * Composes the finished photobooth strip as a story-sized PNG (1080×1920) on a
 * canvas — photos + the chosen frame's paper, decorations, headline and
 * caption. The same renderer serves Just Me and Both of Us; the grid adapts to
 * (people × shots). Like the other share cards, colours come from the frame
 * (fixed palette), never the theme.
 */

const W = 1080;
const H = 1920;

export type ComposeInput = {
  frame: BoothFrame;
  /** Photo sources row by row: shots[shotIndex][personIndex]. */
  shots: string[][];
  /** Person names, same order as the columns. */
  names: string[];
  dateLabel: string;
};

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

export async function composeBoothStrip(input: ComposeInput): Promise<Blob> {
  const { frame, shots, names, dateLabel } = input;
  const rows = shots.length;
  const cols = shots[0]?.length ?? 1;

  const hand = fontFamily("--font-caveat", "'Caveat', cursive");
  const display = fontFamily("--font-fraunces", "Georgia, serif");
  const mono = fontFamily("--font-plex-mono", "ui-monospace, monospace");
  const families = { hand, display, mono } as const;

  const fontTitle =
    frame.titleFont === "hand"
      ? `600 76px ${hand}`
      : frame.titleFont === "display"
        ? `600 58px ${display}`
        : `500 40px ${mono}`;
  const fontNames = `600 58px ${hand}`;
  const fontDate = `400 30px ${mono}`;
  const fontSub = `500 30px ${families[frame.titleFont === "mono" ? "mono" : "display"]}`;

  try {
    await Promise.all([fontTitle, fontNames, fontDate, fontSub].map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  } catch {
    // Canvas falls back to system fonts — still a valid strip.
  }

  const images = await Promise.all(shots.flat().map(loadImage));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  // Backdrop.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, frame.bgTop);
  bg.addColorStop(1, frame.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ---- Card geometry -----------------------------------------------------
  const isFilm = frame.deco === "film";
  const cardW = isFilm && cols === 1 ? 660 : 920;
  const padX = isFilm ? 96 : 56;
  const padTop = 56;
  const padBottom = 44;
  const gap = 26;
  const titleH = frame.title ? (frame.deco === "newsprint" ? 170 : 130) : 28;
  const captionH = frame.subline ? 190 : 150;

  const innerW = cardW - padX * 2;
  const widthFit = (innerW - gap * (cols - 1)) / cols;
  const maxCardH = 1700;
  const heightFit =
    (maxCardH - padTop - titleH - captionH - padBottom - gap * (rows - 1)) / rows;
  const cell = Math.floor(Math.min(widthFit, heightFit));

  const gridW = cell * cols + gap * (cols - 1);
  const gridX = (W - gridW) / 2;
  const cardH = padTop + titleH + rows * cell + (rows - 1) * gap + captionH + padBottom;
  const cardX = (W - cardW) / 2;
  const cardY = (H - cardH) / 2 - 30;

  // The paper.
  ctx.save();
  ctx.shadowColor = "rgba(40, 30, 24, 0.22)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  roundedRect(ctx, cardX, cardY, cardW, cardH, isFilm ? 18 : 44);
  ctx.fillStyle = frame.paper;
  ctx.fill();
  ctx.restore();
  roundedRect(ctx, cardX, cardY, cardW, cardH, isFilm ? 18 : 44);
  ctx.strokeStyle = frame.paperBorder;
  ctx.lineWidth = 3;
  ctx.stroke();

  // ---- Headline ------------------------------------------------------------
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let y = cardY + padTop;

  if (frame.title) {
    if (frame.deco === "newsprint") {
      // Masthead rules above and below, like a front page.
      rule(ctx, cardX + padX, y + 6, innerW, frame.ink, 4);
      rule(ctx, cardX + padX, y + 16, innerW, frame.ink, 1.5);
      ctx.font = fontTitle;
      ctx.fillStyle = frame.ink;
      ctx.fillText(frame.title, W / 2, y + 92);
      rule(ctx, cardX + padX, y + 122, innerW, frame.ink, 1.5);
      ctx.font = fontDate;
      ctx.fillStyle = frame.inkSoft;
      ctx.fillText(`EST. ${dateLabel.toUpperCase()}`, W / 2, y + 156);
    } else {
      ctx.font = fontTitle;
      ctx.fillStyle = frame.accent;
      ctx.fillText(frame.title, W / 2, y + 86);
      if (frame.deco === "sparkle") {
        ctx.font = "44px serif";
        ctx.fillText("✨", W / 2 - measure(ctx, fontTitle, frame.title) / 2 - 52, y + 80);
        ctx.fillText("✨", W / 2 + measure(ctx, fontTitle, frame.title) / 2 + 52, y + 80);
      }
    }
  }
  y += titleH;

  // ---- Photos ---------------------------------------------------------------
  let img = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gridX + c * (cell + gap);
      drawPhoto(ctx, images[img++], x, y, cell, frame);
    }
    y += cell + gap;
  }
  y -= gap;

  // ---- Caption ----------------------------------------------------------------
  const capCenter = y + captionH / 2 + 14;
  ctx.font = fontNames;
  ctx.fillStyle = frame.accent;
  ctx.fillText(names.join(" × "), W / 2, capCenter - (frame.subline ? 26 : 6));
  ctx.font = fontDate;
  ctx.fillStyle = frame.inkSoft;
  ctx.fillText(dateLabel, W / 2, capCenter + (frame.subline ? 16 : 40));
  if (frame.subline) {
    ctx.font = fontSub;
    ctx.fillStyle = frame.inkSoft;
    ctx.fillText(frame.subline, W / 2, capCenter + 66);
  }

  // ---- Decorations (over the paper, around the photos) -----------------------
  drawDeco(ctx, frame, { cardX, cardY, cardW, cardH, padX });

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

// ---- internals ------------------------------------------------------------------

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
  frame: BoothFrame,
) {
  const r = frame.deco === "film" ? 8 : 20;
  ctx.save();
  roundedRect(ctx, x, y, size, size, r);
  ctx.clip();
  ctx.filter = frame.photoFilter;
  // Cover-fit the (square-captured) photo into the square cell.
  const s = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, x, y, size, size);
  ctx.filter = "none";
  ctx.restore();
  roundedRect(ctx, x, y, size, size, r);
  ctx.strokeStyle = frame.photoBorder;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawDeco(
  ctx: CanvasRenderingContext2D,
  frame: BoothFrame,
  g: { cardX: number; cardY: number; cardW: number; cardH: number; padX: number },
) {
  const { cardX, cardY, cardW, cardH } = g;
  const seeded = mulberry32(7);

  const scatter = (glyphs: string[], count: number, sizeMin: number, sizeMax: number, alpha: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = frame.accent;
    ctx.textAlign = "center";
    for (let i = 0; i < count; i++) {
      const onLeft = seeded() < 0.5;
      // Keep the sprinkles in the margins beside the card, never over faces.
      const x = onLeft
        ? cardX * seeded() + 24
        : cardX + cardW + (W - cardX - cardW - 48) * seeded() + 24;
      const yy = cardY - 40 + (cardH + 120) * seeded();
      const size = sizeMin + (sizeMax - sizeMin) * seeded();
      ctx.save();
      ctx.translate(x, yy);
      ctx.rotate((seeded() - 0.5) * 0.9);
      ctx.font = `${Math.round(size)}px serif`;
      ctx.fillText(glyphs[i % glyphs.length], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  switch (frame.deco) {
    case "hearts":
      scatter(["♡", "♥", "🎀", "⭐"], 14, 30, 64, 0.6);
      break;
    case "flowers":
      scatter(["🌷", "✿", "❀", "🌿"], 12, 30, 58, 0.55);
      break;
    case "stickers":
      scatter(["😈", "😜", "⭐", "!!", "💥", "😹"], 14, 34, 66, 0.8);
      break;
    case "sparkle":
      scatter(["✨", "🔥", "✦"], 12, 26, 52, 0.7);
      break;
    case "film": {
      // Sprocket holes down both edges of the strip.
      ctx.save();
      ctx.fillStyle = frame.bgBottom;
      const hole = 26;
      const step = 74;
      for (let yy = cardY + 30; yy < cardY + cardH - 40; yy += step) {
        roundedRect(ctx, cardX + 22, yy, hole, hole * 0.8, 6);
        ctx.fill();
        roundedRect(ctx, cardX + cardW - 22 - hole, yy, hole, hole * 0.8, 6);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case "grain": {
      // A whisper of grain across the whole card.
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = frame.ink;
      for (let i = 0; i < 900; i++) {
        ctx.fillRect(cardX + seeded() * cardW, cardY + seeded() * cardH, 2, 2);
      }
      ctx.restore();
      break;
    }
    case "newsprint":
    case "none":
      break;
  }
}

function rule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string,
  h: number,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function measure(ctx: CanvasRenderingContext2D, font: string, text: string): number {
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

function fontFamily(cssVar: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return v || fallback;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Signed Supabase URLs allow CORS; without this the canvas would taint.
    if (!src.startsWith("data:") && !src.startsWith("blob:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load a photo"));
    img.src = src;
  });
}

/** Tiny seeded PRNG so decorations land the same way on both phones. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
