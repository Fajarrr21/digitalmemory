"use client";

import type { ColoringTemplate } from "@/app/(app)/today/coloring-config";
import type { Fills } from "./coloring-svg";

/**
 * Renders the "A Little Piece of Today" memory card as a story-sized PNG
 * (1080×1920) and hands it to the OS share sheet — on a phone that surfaces
 * Instagram Stories / WhatsApp Status. Where file-sharing isn't available
 * (desktop), the image downloads instead so it can be posted by hand.
 *
 * The exported card uses a fixed warm light palette (not the theme tokens) so
 * the shared picture looks the same no matter which theme the app was in.
 */

const EXPORT = {
  width: 1080,
  height: 1920,
  bgTop: "#fbf5ec",
  bgBottom: "#f7e2e4",
  card: "#fffdf8",
  cardBorder: "#ecdfd2",
  frameBg: "#f6efe2",
  frameBorder: "#e5d9c9",
  ink: "#433d38",
  inkSoft: "#7d766e",
  inkFaint: "#a49c91",
  accent: "#c25b68",
} as const;

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

export async function shareColoringCard(opts: {
  template: ColoringTemplate;
  fills: Fills;
  score: number;
  dateISO: string;
  dateLabel: string;
}): Promise<ShareOutcome> {
  const blob = await renderColoringCardPng(opts);
  const file = new File([blob], `a-little-piece-of-today-${opts.dateISO}.png`, {
    type: "image/png",
  });

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "A Little Piece of Today" });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Anything else (share target failed, NotAllowedError) → fall back to download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

export async function renderColoringCardPng({
  template,
  fills,
  score,
  dateLabel,
}: {
  template: ColoringTemplate;
  fills: Fills;
  score: number;
  dateLabel: string;
}): Promise<Blob> {
  const { width: W, height: H } = EXPORT;

  const hand = fontFamily("--font-caveat", "'Caveat', cursive");
  const display = fontFamily("--font-fraunces", "Georgia, serif");
  const mono = fontFamily("--font-plex-mono", "ui-monospace, monospace");

  const fontTitle = `600 78px ${hand}`;
  const fontScore = `600 94px ${display}`;
  const fontScoreDen = `500 54px ${display}`;
  const fontDate = `400 34px ${mono}`;
  const fontFooter = `600 56px ${hand}`;

  // Make sure the web fonts are usable on the canvas before drawing.
  try {
    await Promise.all(
      [fontTitle, fontScore, fontScoreDen, fontDate, fontFooter].map((f) =>
        document.fonts.load(f),
      ),
    );
    await document.fonts.ready;
  } catch {
    // Fall back to whatever the canvas resolves — still a valid card.
  }

  const scene = await loadSceneImage(template, fills, EXPORT.ink);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  // Backdrop — a soft cream-to-blush wash.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, EXPORT.bgTop);
  bg.addColorStop(1, EXPORT.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // The card.
  const cardW = 860;
  const cardX = (W - cardW) / 2;
  const cardH = 1150;
  const cardY = 350;

  ctx.save();
  ctx.shadowColor = "rgba(96, 62, 54, 0.18)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 26;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.fillStyle = EXPORT.card;
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.strokeStyle = EXPORT.cardBorder;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let y = cardY + 80;

  // Title.
  y += 60;
  ctx.font = fontTitle;
  ctx.fillStyle = EXPORT.accent;
  ctx.fillText("A Little Piece of Today", W / 2, y);

  // Score — "7" in accent, "/10" smaller and soft, baseline-aligned.
  y += 130;
  ctx.font = fontScore;
  const scoreText = String(score);
  const scoreW = ctx.measureText(scoreText).width;
  ctx.font = fontScoreDen;
  const denW = ctx.measureText("/10").width;
  const scoreLeft = W / 2 - (scoreW + 8 + denW) / 2;
  ctx.textAlign = "left";
  ctx.font = fontScore;
  ctx.fillStyle = EXPORT.accent;
  ctx.fillText(scoreText, scoreLeft, y);
  ctx.font = fontScoreDen;
  ctx.fillStyle = EXPORT.inkSoft;
  ctx.fillText("/10", scoreLeft + scoreW + 8, y);
  ctx.textAlign = "center";

  // The coloured scene in its little frame.
  y += 50;
  const frameSize = 640;
  const frameX = (W - frameSize) / 2;
  roundedRect(ctx, frameX, y, frameSize, frameSize, 32);
  ctx.fillStyle = EXPORT.frameBg;
  ctx.fill();
  ctx.strokeStyle = EXPORT.frameBorder;
  ctx.lineWidth = 3;
  ctx.stroke();
  const inset = 32;
  ctx.drawImage(scene, frameX + inset, y + inset, frameSize - inset * 2, frameSize - inset * 2);

  // Date.
  y += frameSize + 84;
  ctx.font = fontDate;
  ctx.fillStyle = EXPORT.inkFaint;
  ctx.fillText(dateLabel, W / 2, y);

  // Footer under the card.
  ctx.font = fontFooter;
  ctx.fillStyle = EXPORT.accent;
  ctx.fillText("our little universe ♡", W / 2, cardY + cardH + 110);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not export the image"))),
      "image/png",
    );
  });
}

/** Resolve a next/font CSS variable into a canvas-usable font-family list. */
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

/** Rasterize the scene by serializing it to a standalone SVG with explicit colours. */
function loadSceneImage(
  template: ColoringTemplate,
  fills: Fills,
  ink: string,
): Promise<HTMLImageElement> {
  const parts = template.regions.map((r) => {
    const fill = r.decorative ? "none" : fills[r.id] ?? "transparent";
    // No vector-effect here (unlike the on-screen SVG): strokes should scale
    // with the export size so the lines keep their hand-drawn weight.
    const attrs =
      `fill="${fill}" stroke="${ink}" stroke-width="2.4" ` +
      `stroke-linejoin="round" stroke-linecap="round"` +
      (r.transform ? ` transform="${r.transform}"` : "");
    const g = r.geom;
    switch (g.el) {
      case "path":
        return `<path d="${g.d}" ${attrs}/>`;
      case "circle":
        return `<circle cx="${g.cx}" cy="${g.cy}" r="${g.r}" ${attrs}/>`;
      case "ellipse":
        return `<ellipse cx="${g.cx}" cy="${g.cy}" rx="${g.rx}" ry="${g.ry}" ${attrs}/>`;
      case "rect":
        return `<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}"${g.rx != null ? ` rx="${g.rx}"` : ""} ${attrs}/>`;
      case "polygon":
        return `<polygon points="${g.points}" ${attrs}/>`;
      case "line":
        return `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" ${attrs}/>`;
      case "polyline":
        return `<polyline points="${g.points}" ${attrs}/>`;
      default:
        return "";
    }
  });

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${template.viewBox}" ` +
    `width="1160" height="1160">${parts.join("")}</svg>`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not render the drawing"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
