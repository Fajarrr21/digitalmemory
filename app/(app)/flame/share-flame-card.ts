"use client";

import { tierFor, type Milestone } from "./flame-config";

/**
 * Milestone share card — a story-sized (1080×1920) PNG: the flame, DAY N,
 * both profile photos, names, the milestone's own line, "Our Little Flame".
 * Shared through the OS share sheet (IG Story / WA Status on a phone),
 * downloaded elsewhere. Manual only — nothing auto-posts.
 */

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

export async function shareFlameCard(opts: {
  milestone: Milestone;
  youName: string;
  partnerName: string;
  youAvatarUrl: string | null;
  partnerAvatarUrl: string | null;
}): Promise<ShareOutcome> {
  const blob = await renderFlameCardPng(opts);
  const file = new File([blob], `our-little-flame-day-${opts.milestone.day}.png`, {
    type: "image/png",
  });

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Our Little Flame" });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
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

async function renderFlameCardPng({
  milestone,
  youName,
  partnerName,
  youAvatarUrl,
  partnerAvatarUrl,
}: {
  milestone: Milestone;
  youName: string;
  partnerName: string;
  youAvatarUrl: string | null;
  partnerAvatarUrl: string | null;
}): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const tier = tierFor(milestone.day);

  const display = fontFamily("--font-fraunces", "Georgia, serif");
  const hand = fontFamily("--font-caveat", "'Caveat', cursive");
  const mono = fontFamily("--font-plex-mono", "ui-monospace, monospace");

  const fontDay = `600 150px ${display}`;
  const fontNames = `500 44px ${mono}`;
  const fontQuote = `600 62px ${hand}`;
  const fontFooter = `600 52px ${hand}`;
  const fontInitial = `600 90px ${display}`;

  try {
    await Promise.all(
      [fontDay, fontNames, fontQuote, fontFooter, fontInitial].map((f) => document.fonts.load(f)),
    );
    await document.fonts.ready;
  } catch {
    // fall back to resolved fonts
  }

  const [imgYou, imgPartner] = await Promise.all([
    youAvatarUrl ? loadImage(youAvatarUrl) : null,
    partnerAvatarUrl ? loadImage(partnerAvatarUrl) : null,
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  // Night-ember backdrop.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#211318");
  bg.addColorStop(0.55, "#2b181a");
  bg.addColorStop(1, "#1c1013");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Warm glow behind the flame.
  const glow = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 460);
  glow.addColorStop(0, `${tier.glow}59`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 1050);

  // The flame — three teardrop layers.
  drawTeardrop(ctx, W / 2, 330, 300, 380, tier.outer);
  drawTeardrop(ctx, W / 2, 420, 205, 275, tier.mid);
  drawTeardrop(ctx, W / 2, 505, 115, 175, tier.core);

  // A few embers.
  ctx.fillStyle = `${tier.mid}cc`;
  for (const [ex, ey, er] of [
    [W / 2 - 210, 420, 6],
    [W / 2 + 190, 360, 5],
    [W / 2 + 240, 560, 4],
    [W / 2 - 250, 600, 4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // DAY N
  ctx.font = fontDay;
  ctx.fillStyle = "#fdf3e3";
  ctx.fillText(`DAY ${milestone.day}`, W / 2, 940);

  // Avatars.
  const r = 110;
  const gap = 60;
  const cy = 1150;
  const ax = W / 2 - r - gap / 2;
  const bx = W / 2 + r + gap / 2;
  drawAvatar(ctx, imgYou, initialOf(youName), ax, cy, r, tier.glow, fontInitial);
  drawAvatar(ctx, imgPartner, initialOf(partnerName), bx, cy, r, tier.glow, fontInitial);
  // × between
  ctx.font = `500 54px ${display}`;
  ctx.fillStyle = "#c8a08a";
  ctx.fillText("×", W / 2, cy + 18);

  // Names.
  ctx.font = fontNames;
  ctx.fillStyle = "#e9d7c3";
  ctx.fillText(`${youName}  ×  ${partnerName}`, W / 2, cy + r + 110);

  // Quote, wrapped.
  ctx.font = fontQuote;
  ctx.fillStyle = "#f2cfae";
  const lines = wrap(ctx, `“${milestone.line}”`, W - 240);
  let qy = 1520;
  for (const line of lines) {
    ctx.fillText(line, W / 2, qy);
    qy += 78;
  }

  // Footer.
  ctx.font = fontFooter;
  ctx.fillStyle = "#e8a08a";
  ctx.fillText("Our Little Flame 🔥", W / 2, H - 110);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not export the image"))),
      "image/png",
    );
  });
}

// ---- drawing helpers --------------------------------------------------------

/** Teardrop: pointed top, round bottom. topY is the tip; h down from there. */
function drawTeardrop(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  w: number,
  h: number,
  color: string,
) {
  const half = w / 2;
  const bottomY = topY + h;
  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.bezierCurveTo(cx + half * 0.9, topY + h * 0.45, cx + half, topY + h * 0.72, cx + half * 0.62, bottomY - h * 0.08);
  ctx.quadraticCurveTo(cx, bottomY + h * 0.08, cx - half * 0.62, bottomY - h * 0.08);
  ctx.bezierCurveTo(cx - half, topY + h * 0.72, cx - half * 0.9, topY + h * 0.45, cx, topY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  initial: string,
  cx: number,
  cy: number,
  r: number,
  ring: string,
  initialFont: string,
) {
  // ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.strokeStyle = `${ring}aa`;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    // cover-fit
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "#4a2b30";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.font = initialFont;
    ctx.fillStyle = "#f4b6bd";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial, cx, cy + 6);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
}

function initialOf(name: string): string {
  return (name.trim()[0] ?? "♡").toUpperCase();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fontFamily(cssVar: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return v || fallback;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // fall back to the initial circle
    img.src = url;
  });
}
