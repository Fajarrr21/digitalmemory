"use client";

/**
 * The Canvas — one renderer for both the live preview and the PNG export,
 * so what you see is exactly what you save. Everything is drawn in "card
 * space" (the export pixel size, e.g. 1080×1920); the preview just scales
 * the context. Backgrounds are procedural (gradients, soft blobs, seeded
 * grain) — no image assets, nothing to load — and seeded, so the grain in
 * the preview is the same grain in the file.
 */

export type BackgroundKey =
  | "dusty_pink"
  | "blush_watercolor"
  | "vintage_paper"
  | "cream_editorial"
  | "rose_texture"
  | "lavender_haze"
  | "midnight"
  | "soft_brown"
  | "minimal_white"
  | "custom";

export type FontKey = "elegant" | "classic" | "hand" | "sans" | "editorial";
export type FormatKey = "story" | "square" | "portrait" | "custom";
export type SignatureMode = "none" | "name" | "pen" | "initials" | "drawn";

export type CardDesign = {
  text: string;
  title: string;
  showTitle: boolean;
  background: BackgroundKey;
  customColor: string;
  /** Darken an uploaded photo so text stays readable, 0–0.7. */
  customDim: number;
  font: FontKey;
  /** Font size in card pixels at a 1080-wide card. */
  size: number;
  color: string;
  accent: string;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  italic: boolean;
  bold: boolean;
  underline: boolean;
  /** Block centre, as fractions of the card. */
  x: number;
  y: number;
  /** Word indices (over whitespace-split words) drawn in the accent colour. */
  highlights: number[];
  signature: SignatureMode;
  signatureText: string;
  /** Normalised strokes (0–1) from the signature pad. */
  strokes: [number, number][][];
  format: FormatKey;
  customW: number;
  customH: number;
};

export const BACKGROUNDS: { key: BackgroundKey; label: string; ink: string; accent: string; swatch: string }[] = [
  { key: "dusty_pink", label: "Dusty Pink", ink: "#4a2c2f", accent: "#fff6f0", swatch: "linear-gradient(160deg,#e2b4b1,#c99597)" },
  { key: "blush_watercolor", label: "Blush Watercolor", ink: "#5b3a3f", accent: "#c25b68", swatch: "radial-gradient(circle at 30% 30%,#f4c9cc,#fbeeee 70%)" },
  { key: "vintage_paper", label: "Vintage Paper", ink: "#3f3226", accent: "#9b4a3c", swatch: "radial-gradient(circle,#f1e4c9,#d9c39b)" },
  { key: "cream_editorial", label: "Cream Editorial", ink: "#2f2a25", accent: "#b2565f", swatch: "#f6f0e4" },
  { key: "rose_texture", label: "Rose Texture", ink: "#fff5f2", accent: "#ffe1d6", swatch: "linear-gradient(135deg,#c98b8f,#a86b72)" },
  { key: "lavender_haze", label: "Lavender Haze", ink: "#3d3450", accent: "#8a5aa8", swatch: "linear-gradient(170deg,#e4daf3,#f6e5ee)" },
  { key: "midnight", label: "Midnight Poetry", ink: "#efe8dc", accent: "#f2c27c", swatch: "linear-gradient(170deg,#141a2e,#2a3052)" },
  { key: "soft_brown", label: "Soft Brown", ink: "#fbf3ea", accent: "#ffd9b8", swatch: "linear-gradient(170deg,#bb9d83,#9e7e66)" },
  { key: "minimal_white", label: "Minimal White", ink: "#222222", accent: "#b76a74", swatch: "#fbfbf9" },
  { key: "custom", label: "Custom", ink: "#2b2b2b", accent: "#b76a74", swatch: "conic-gradient(#f4c9cc,#e4daf3,#f1e4c9,#f4c9cc)" },
];

export const FONTS: { key: FontKey; label: string; cssVar: string; fallback: string; scale: number }[] = [
  { key: "elegant", label: "Elegant Serif", cssVar: "--font-fraunces", fallback: "Georgia, serif", scale: 1 },
  { key: "classic", label: "Classic Serif", cssVar: "--font-cormorant", fallback: "'Times New Roman', serif", scale: 1.12 },
  { key: "hand", label: "Handwritten", cssVar: "--font-caveat", fallback: "cursive", scale: 1.25 },
  { key: "sans", label: "Minimal Sans", cssVar: "--font-instrument", fallback: "system-ui, sans-serif", scale: 0.92 },
  { key: "editorial", label: "Editorial", cssVar: "--font-playfair", fallback: "Georgia, serif", scale: 0.98 },
];

export const FORMATS: { key: FormatKey; label: string; w: number; h: number }[] = [
  { key: "story", label: "9:16 Story", w: 1080, h: 1920 },
  { key: "square", label: "1:1", w: 1080, h: 1080 },
  { key: "portrait", label: "4:5", w: 1080, h: 1350 },
  { key: "custom", label: "Custom", w: 1200, h: 1600 },
];

export function cardSize(d: Pick<CardDesign, "format" | "customW" | "customH">): { w: number; h: number } {
  if (d.format === "custom") {
    const clamp = (n: number) => Math.round(Math.min(4000, Math.max(320, n || 0)));
    return { w: clamp(d.customW), h: clamp(d.customH) };
  }
  const f = FORMATS.find((x) => x.key === d.format) ?? FORMATS[0];
  return { w: f.w, h: f.h };
}

export const DEFAULT_DESIGN: CardDesign = {
  text: "",
  title: "",
  showTitle: false,
  background: "blush_watercolor",
  customColor: "#f3e7e1",
  customDim: 0.25,
  font: "elegant",
  size: 46,
  color: "#5b3a3f",
  accent: "#c25b68",
  align: "center",
  letterSpacing: 0,
  lineHeight: 1.55,
  italic: false,
  bold: false,
  underline: false,
  x: 0.5,
  y: 0.5,
  highlights: [],
  signature: "none",
  signatureText: "",
  strokes: [],
  format: "story",
  customW: 1200,
  customH: 1600,
};

/* ------------------------------------------------------------- helpers -- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grain(ctx: CanvasRenderingContext2D, W: number, H: number, opts: { seed: number; count: number; color: string; alpha: number; size?: number }) {
  const rand = mulberry32(opts.seed);
  const n = Math.round((opts.count * W * H) / (1080 * 1920));
  ctx.save();
  ctx.fillStyle = opts.color;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = opts.alpha * (0.4 + rand() * 0.6);
    const s = (opts.size ?? 1.6) * (0.6 + rand() * 0.9);
    ctx.fillRect(rand() * W, rand() * H, s, s);
  }
  ctx.restore();
}

/** "#rrggbb" at alpha 0 — fading to plain "transparent" (= transparent BLACK) muddies soft colours grey. */
function clear(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, clear(color));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function linear(ctx: CanvasRenderingContext2D, W: number, H: number, a: string, b: string) {
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function vignette(ctx: CanvasRenderingContext2D, W: number, H: number, color: string, strength: number) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, clear(color));
  g.addColorStop(1, color);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function drawBackground(ctx: CanvasRenderingContext2D, d: CardDesign, W: number, H: number, image: CanvasImageSource | null) {
  const u = Math.min(W, H) / 1080;
  switch (d.background) {
    case "dusty_pink":
      linear(ctx, W, H, "#e3b6b3", "#c9979a");
      blob(ctx, W * 0.2, H * 0.15, 600 * u, "#f3d2cd", 0.5);
      grain(ctx, W, H, { seed: 11, count: 9000, color: "#ffffff", alpha: 0.12 });
      break;
    case "blush_watercolor": {
      ctx.fillStyle = "#fcf1f0";
      ctx.fillRect(0, 0, W, H);
      const rand = mulberry32(7);
      const pinks = ["#f4c3c8", "#f7d6d3", "#efb3bb", "#f9e0dc", "#e9c3d6"];
      for (let i = 0; i < 14; i++) {
        blob(ctx, rand() * W, rand() * H, (260 + rand() * 520) * u, pinks[i % pinks.length], 0.35 + rand() * 0.3);
      }
      grain(ctx, W, H, { seed: 3, count: 6000, color: "#b98a8e", alpha: 0.06 });
      break;
    }
    case "vintage_paper": {
      ctx.fillStyle = "#efe1c5";
      ctx.fillRect(0, 0, W, H);
      const rand = mulberry32(21);
      ctx.save();
      ctx.strokeStyle = "#c9b089";
      for (let i = 0; i < 220 * (H / 1920); i++) {
        ctx.globalAlpha = 0.05 + rand() * 0.06;
        ctx.lineWidth = 1 + rand() * 1.5;
        const y = rand() * H;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(W * 0.3, y + (rand() - 0.5) * 12, W * 0.7, y + (rand() - 0.5) * 12, W, y);
        ctx.stroke();
      }
      ctx.restore();
      grain(ctx, W, H, { seed: 22, count: 14000, color: "#7a5d3a", alpha: 0.12 });
      for (let i = 0; i < 18; i++) blob(ctx, rand() * W, rand() * H, (30 + rand() * 90) * u, "#b8935e", 0.08);
      vignette(ctx, W, H, "#8a6a42", 0.45);
      break;
    }
    case "cream_editorial": {
      ctx.fillStyle = "#f6f0e4";
      ctx.fillRect(0, 0, W, H);
      grain(ctx, W, H, { seed: 31, count: 5000, color: "#8c7b66", alpha: 0.08 });
      const m = 56 * u;
      ctx.save();
      ctx.strokeStyle = "#2f2a25";
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2 * u;
      ctx.strokeRect(m, m, W - m * 2, H - m * 2);
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1 * u;
      ctx.strokeRect(m + 14 * u, m + 14 * u, W - (m + 14 * u) * 2, H - (m + 14 * u) * 2);
      ctx.restore();
      break;
    }
    case "rose_texture": {
      linear(ctx, W, H, "#cc8e92", "#a56870");
      const rand = mulberry32(41);
      ctx.save();
      ctx.strokeStyle = "#7d4650";
      for (let i = 0; i < 900 * ((W * H) / (1080 * 1920)); i++) {
        ctx.globalAlpha = 0.04 + rand() * 0.07;
        ctx.lineWidth = 1 + rand() * 2;
        const x = rand() * W;
        const y = rand() * H;
        const l = (20 + rand() * 60) * u;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + l, y + l * 0.6);
        ctx.stroke();
      }
      ctx.restore();
      blob(ctx, W * 0.8, H * 0.2, 700 * u, "#e7aeb2", 0.35);
      grain(ctx, W, H, { seed: 42, count: 8000, color: "#ffffff", alpha: 0.08 });
      break;
    }
    case "lavender_haze":
      linear(ctx, W, H, "#e3d9f2", "#f7e6ee");
      blob(ctx, W * 0.75, H * 0.25, 700 * u, "#d1c0ec", 0.6);
      blob(ctx, W * 0.2, H * 0.8, 650 * u, "#f3cfe0", 0.55);
      blob(ctx, W * 0.5, H * 0.55, 500 * u, "#ffffff", 0.35);
      grain(ctx, W, H, { seed: 51, count: 5000, color: "#7e6c9a", alpha: 0.05 });
      break;
    case "midnight": {
      linear(ctx, W, H, "#121729", "#283052");
      blob(ctx, W * 0.8, H * 0.12, 520 * u, "#3d4675", 0.6);
      const rand = mulberry32(61);
      ctx.save();
      ctx.fillStyle = "#fff6e0";
      const stars = Math.round(260 * ((W * H) / (1080 * 1920)));
      for (let i = 0; i < stars; i++) {
        ctx.globalAlpha = 0.2 + rand() * 0.7;
        const r = (0.6 + rand() * 1.8) * u;
        ctx.beginPath();
        ctx.arc(rand() * W, rand() * H, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      grain(ctx, W, H, { seed: 62, count: 5000, color: "#ffffff", alpha: 0.04 });
      break;
    }
    case "soft_brown":
      linear(ctx, W, H, "#bd9f85", "#9b7b63");
      blob(ctx, W * 0.3, H * 0.2, 650 * u, "#d6bba2", 0.45);
      grain(ctx, W, H, { seed: 71, count: 9000, color: "#3d2a1c", alpha: 0.08 });
      vignette(ctx, W, H, "#5e4331", 0.35);
      break;
    case "minimal_white":
      ctx.fillStyle = "#fbfbf9";
      ctx.fillRect(0, 0, W, H);
      break;
    case "custom": {
      ctx.fillStyle = d.customColor || "#f3e7e1";
      ctx.fillRect(0, 0, W, H);
      if (image) {
        const iw = (image as HTMLImageElement).naturalWidth || (image as ImageBitmap).width;
        const ih = (image as HTMLImageElement).naturalHeight || (image as ImageBitmap).height;
        if (iw && ih) {
          const s = Math.max(W / iw, H / ih);
          const dw = iw * s;
          const dh = ih * s;
          ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
          if (d.customDim > 0) {
            ctx.save();
            ctx.globalAlpha = d.customDim;
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
          }
        }
      }
      break;
    }
  }
}

/* ---------------------------------------------------------------- text -- */

export type FontFamilies = Record<FontKey, string>;

export function resolveFonts(root: Element | null): FontFamilies {
  const style = root ? getComputedStyle(root) : null;
  const out = {} as FontFamilies;
  for (const f of FONTS) {
    const v = style?.getPropertyValue(f.cssVar).trim();
    out[f.key] = v ? `${v}, ${f.fallback}` : f.fallback;
  }
  return out;
}

export function fontString(d: Pick<CardDesign, "italic" | "bold" | "font">, px: number, families: FontFamilies) {
  const weight = d.font === "hand" ? 600 : d.bold ? 600 : 400;
  return `${d.italic && d.font !== "hand" ? "italic " : ""}${weight} ${px}px ${families[d.font]}`;
}

type Token = { text: string; space: boolean; word: number };

/** Split into lines of tokens that fit `maxW`, honouring the writer's own line breaks. */
function layout(ctx: CanvasRenderingContext2D, text: string, maxW: number): Token[][] {
  const lines: Token[][] = [];
  let wordIndex = 0;
  for (const para of text.replace(/\r\n?/g, "\n").split("\n")) {
    const parts = para.split(/(\s+)/).filter((p) => p.length);
    if (!parts.length) {
      lines.push([]);
      continue;
    }
    let line: Token[] = [];
    let width = 0;
    for (const p of parts) {
      const space = /^\s+$/.test(p);
      const tok: Token = { text: space ? " " : p, space, word: space ? -1 : wordIndex++ };
      const w = ctx.measureText(tok.text).width;
      if (!space && line.length && width + w > maxW) {
        while (line.length && line[line.length - 1].space) line.pop();
        lines.push(line);
        line = [];
        width = 0;
      }
      if (space && !line.length) continue;
      line.push(tok);
      width += w;
    }
    while (line.length && line[line.length - 1].space) line.pop();
    lines.push(line);
  }
  return lines;
}

export type Layout = { blockH: number; overflow: boolean };

/**
 * Draw the whole card. Returns how tall the text block was, so the studio
 * can warn when it no longer fits.
 */
export function drawCard(
  ctx: CanvasRenderingContext2D,
  d: CardDesign,
  W: number,
  H: number,
  families: FontFamilies,
  image: CanvasImageSource | null,
): Layout {
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, d, W, H, image);

  const u = W / 1080;
  const fontScale = FONTS.find((f) => f.key === d.font)?.scale ?? 1;
  const px = d.size * u * fontScale;
  const lh = px * d.lineHeight;
  const margin = Math.max(72 * u, W * 0.09);
  const maxW = W - margin * 2;
  const font = fontString(d, px, families);
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  const spacing = d.letterSpacing * u;
  const supportsSpacing = "letterSpacing" in ctx;
  if (supportsSpacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;

  const lines = layout(ctx, d.text, maxW);

  // Title (optional) sits above the text block in small caps-ish mono.
  const titlePx = 26 * u;
  const titleGap = d.showTitle && d.title.trim() ? titlePx * 2.4 : 0;
  const blockH = lines.length * lh + titleGap;
  const cx = d.x * W;
  const top = Math.min(H - margin - blockH, Math.max(margin, d.y * H - blockH / 2));
  const left = Math.min(W - margin - maxW, Math.max(margin, cx - maxW / 2));

  const anchorX = d.align === "left" ? left : d.align === "right" ? left + maxW : left + maxW / 2;

  if (titleGap) {
    ctx.save();
    if (supportsSpacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${4 * u}px`;
    ctx.font = `500 ${titlePx}px ${families.sans}`;
    ctx.fillStyle = d.color;
    ctx.globalAlpha = 0.75;
    ctx.textAlign = d.align;
    ctx.fillText(d.title.trim().toUpperCase(), anchorX, top + titlePx);
    ctx.restore();
    ctx.font = font;
    if (supportsSpacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
  }

  const highlight = new Set(d.highlights);
  ctx.textAlign = "left";
  lines.forEach((line, i) => {
    const baseline = top + titleGap + i * lh + lh * 0.5 + px * 0.34;
    const widths = line.map((t) => ctx.measureText(t.text).width);
    const lineW = widths.reduce((s, w) => s + w, 0);
    let x = d.align === "left" ? left : d.align === "right" ? left + maxW - lineW : left + (maxW - lineW) / 2;
    const startX = x;
    line.forEach((t, j) => {
      ctx.fillStyle = !t.space && highlight.has(t.word) ? d.accent : d.color;
      ctx.fillText(t.text, x, baseline);
      x += widths[j];
    });
    if (d.underline && lineW > 0) {
      ctx.save();
      ctx.strokeStyle = d.color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, px * 0.05);
      ctx.beginPath();
      ctx.moveTo(startX, baseline + px * 0.16);
      ctx.lineTo(startX + lineW, baseline + px * 0.16);
      ctx.stroke();
      ctx.restore();
    }
  });

  drawSignature(ctx, d, W, H, families, { left, maxW, bottom: top + blockH });
  if (supportsSpacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  return { blockH, overflow: blockH > H - margin * 2 };
}

function drawSignature(
  ctx: CanvasRenderingContext2D,
  d: CardDesign,
  W: number,
  H: number,
  families: FontFamilies,
  box: { left: number; maxW: number; bottom: number },
) {
  if (d.signature === "none") return;
  const u = W / 1080;
  const right = box.left + box.maxW;
  const y = Math.min(H - 70 * u, box.bottom + 110 * u);
  ctx.save();
  ctx.fillStyle = d.color;
  ctx.strokeStyle = d.color;
  if (supports(ctx)) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  if (d.signature === "drawn") {
    if (!d.strokes.length) {
      ctx.restore();
      return;
    }
    const sw = 300 * u;
    const sh = 120 * u;
    const x0 = d.align === "left" ? box.left : d.align === "center" ? W / 2 - sw / 2 : right - sw;
    const y0 = y - sh * 0.75;
    ctx.lineWidth = 4 * u;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.9;
    for (const s of d.strokes) {
      if (!s.length) continue;
      ctx.beginPath();
      ctx.moveTo(x0 + s[0][0] * sw, y0 + s[0][1] * sh);
      for (let i = 1; i < s.length - 1; i++) {
        const mx = (s[i][0] + s[i + 1][0]) / 2;
        const my = (s[i][1] + s[i + 1][1]) / 2;
        ctx.quadraticCurveTo(x0 + s[i][0] * sw, y0 + s[i][1] * sh, x0 + mx * sw, y0 + my * sh);
      }
      const last = s[s.length - 1];
      ctx.lineTo(x0 + last[0] * sw, y0 + last[1] * sh);
      ctx.stroke();
    }
  } else {
    const raw = d.signatureText.trim();
    if (!raw) {
      ctx.restore();
      return;
    }
    const text =
      d.signature === "initials"
        ? raw
            .split(/\s+/)
            .map((w) => w[0]?.toUpperCase() ?? "")
            .join(".") + "."
        : `— ${raw}`;
    const hand = d.signature === "initials" ? families.editorial : families.hand;
    ctx.font = `${d.signature === "initials" ? "italic 400" : "600"} ${42 * u}px ${hand}`;
    ctx.globalAlpha = 0.9;
    ctx.textAlign = d.align === "left" ? "left" : d.align === "center" ? "center" : "right";
    ctx.fillText(text, d.align === "left" ? box.left : d.align === "center" ? W / 2 : right, y);
  }
  ctx.restore();
}

function supports(ctx: CanvasRenderingContext2D) {
  return "letterSpacing" in ctx;
}

/** Make sure the web fonts a design uses are ready before drawing. */
export async function loadFonts(d: CardDesign, families: FontFamilies) {
  try {
    await Promise.all([
      document.fonts.load(fontString(d, 40, families)),
      document.fonts.load(`600 40px ${families.hand}`),
      document.fonts.load(`500 26px ${families.sans}`),
      document.fonts.load(`italic 400 40px ${families.editorial}`),
    ]);
  } catch {
    // Draw with whatever resolves — still a valid card.
  }
}

export async function exportCardPng(
  d: CardDesign,
  families: FontFamilies,
  image: CanvasImageSource | null,
): Promise<Blob> {
  const { w, h } = cardSize(d);
  await loadFonts(d, families);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  drawCard(ctx, d, w, h, families, image);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("export failed"))), "image/png"));
}

/** Word list as the renderer indexes it — for the highlight picker. */
export function cardWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
