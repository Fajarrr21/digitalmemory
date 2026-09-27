import { MILESTONES } from "../flame/flame-config";

/**
 * A Little Photo Booth — frames, pose prompts, and layout constants.
 *
 * Frames are pure data; the one canvas renderer (compose-strip.ts) reads these
 * tokens. Like the other share cards, frames use FIXED colours (not the theme
 * tokens) so the exported picture looks the same in any theme.
 *
 * Milestone frames (🔥 DAY N) are derived from the flame milestones and unlock
 * automatically once the couple's best flame has reached that day.
 */

export type BoothDeco =
  | "none"
  | "hearts"
  | "flowers"
  | "film"
  | "newsprint"
  | "grain"
  | "stickers"
  | "sparkle";

export type BoothFrame = {
  id: string;
  name: string;
  emoji: string;
  /** Little descriptor under the name in the picker. */
  tagline: string;
  /** Backdrop gradient of the exported card. */
  bgTop: string;
  bgBottom: string;
  /** The "paper" the photos sit on. */
  paper: string;
  paperBorder: string;
  photoBorder: string;
  ink: string;
  inkSoft: string;
  accent: string;
  /** Headline over the photos (null = no headline). */
  title: string | null;
  titleFont: "hand" | "display" | "mono";
  /** A soft line under the photos (milestone frames use the milestone line). */
  subline: string | null;
  deco: BoothDeco;
  /** Canvas ctx.filter applied when drawing the photos. */
  photoFilter: string;
  /** Milestone frames only: the flame day that unlocks it. */
  milestoneDay?: number;
};

export const BOOTH_FRAMES: BoothFrame[] = [
  {
    id: "minimal",
    name: "Minimal",
    emoji: "🤍",
    tagline: "simple & clean",
    bgTop: "#faf7f2",
    bgBottom: "#f3ede4",
    paper: "#fffdf8",
    paperBorder: "#e9e1d5",
    photoBorder: "#efe8dc",
    ink: "#433d38",
    inkSoft: "#7d766e",
    accent: "#433d38",
    title: null,
    titleFont: "mono",
    subline: null,
    deco: "none",
    photoFilter: "none",
  },
  {
    id: "cute",
    name: "Cute",
    emoji: "🎀",
    tagline: "hearts & ribbons",
    bgTop: "#fdeef1",
    bgBottom: "#fbdfe6",
    paper: "#fffafb",
    paperBorder: "#f3cdd7",
    photoBorder: "#f6d8e0",
    ink: "#4a3238",
    inkSoft: "#8a6a72",
    accent: "#d15b74",
    title: "a little us ♡",
    titleFont: "hand",
    subline: null,
    deco: "hearts",
    photoFilter: "saturate(1.08) brightness(1.02)",
  },
  {
    id: "romantic",
    name: "Romantic",
    emoji: "🌷",
    tagline: "a little moment of us",
    bgTop: "#fbf3ee",
    bgBottom: "#f4dfd8",
    paper: "#fffcf9",
    paperBorder: "#e9cfc4",
    photoBorder: "#eedbd2",
    ink: "#463a35",
    inkSoft: "#84726a",
    accent: "#b8556a",
    title: "a little moment of us",
    titleFont: "hand",
    subline: null,
    deco: "flowers",
    photoFilter: "sepia(0.12) saturate(1.05)",
  },
  {
    id: "film",
    name: "Film Strip",
    emoji: "🎞️",
    tagline: "like the real booth",
    bgTop: "#2b2724",
    bgBottom: "#1d1a18",
    paper: "#161412",
    paperBorder: "#3a352f",
    photoBorder: "#4a443c",
    ink: "#f2ece2",
    inkSoft: "#b3aa9c",
    accent: "#f2ece2",
    title: null,
    titleFont: "mono",
    subline: null,
    deco: "film",
    photoFilter: "contrast(1.06) saturate(0.95)",
  },
  {
    id: "newspaper",
    name: "Newspaper",
    emoji: "📰",
    tagline: "front page news",
    bgTop: "#f4f1ea",
    bgBottom: "#e9e4d8",
    paper: "#faf8f1",
    paperBorder: "#c9c2b2",
    photoBorder: "#b9b2a2",
    ink: "#2e2b26",
    inkSoft: "#6b665c",
    accent: "#2e2b26",
    title: "THE DAY WE TOOK THIS",
    titleFont: "display",
    subline: "all the news that matters is right here",
    deco: "newsprint",
    photoFilter: "grayscale(1) contrast(1.08)",
  },
  {
    id: "dreamy",
    name: "Dreamy",
    emoji: "☁️",
    tagline: "soft & hazy",
    bgTop: "#eef0fb",
    bgBottom: "#f8e7ef",
    paper: "#fffdfe",
    paperBorder: "#e3ddef",
    photoBorder: "#e9e2f1",
    ink: "#453f4d",
    inkSoft: "#837c90",
    accent: "#8d7bb8",
    title: "like a soft dream",
    titleFont: "hand",
    subline: null,
    deco: "grain",
    photoFilter: "saturate(0.9) brightness(1.06) contrast(0.96)",
  },
  {
    id: "silly",
    name: "Silly",
    emoji: "😈",
    tagline: "certified silly",
    bgTop: "#fdf3d8",
    bgBottom: "#fbe3b6",
    paper: "#fffcf2",
    paperBorder: "#ecd39a",
    photoBorder: "#f1dcae",
    ink: "#4a4030",
    inkSoft: "#8a7c5f",
    accent: "#d97b29",
    title: "certified silly",
    titleFont: "hand",
    subline: "no serious faces were harmed",
    deco: "stickers",
    photoFilter: "saturate(1.18)",
  },
];

/** 🔥 DAY N frames — one per flame milestone, unlocked by the best flame. */
export const MILESTONE_FRAMES: BoothFrame[] = MILESTONES.map((m) => ({
  id: `day-${m.day}`,
  name: `🔥 Day ${m.day}`,
  emoji: "🔥",
  tagline: m.title,
  bgTop: "#fbf1e4",
  bgBottom: "#f7d9cb",
  paper: "#fffbf4",
  paperBorder: "#eccfb4",
  photoBorder: "#f0d9c2",
  ink: "#46372e",
  inkSoft: "#87715f",
  accent: "#d1642f",
  title: `🔥 DAY ${m.day}`,
  titleFont: "display",
  subline: m.line,
  deco: "sparkle",
  photoFilter: "sepia(0.08) saturate(1.06)",
  milestoneDay: m.day,
}));

export const ALL_FRAMES: BoothFrame[] = [...BOOTH_FRAMES, ...MILESTONE_FRAMES];

export function frameById(id: string | null | undefined): BoothFrame {
  return ALL_FRAMES.find((f) => f.id === id) ?? BOOTH_FRAMES[0];
}

/** Milestone frames unlock once the best flame has been there. */
export function isFrameUnlocked(frame: BoothFrame, bestFlameDay: number): boolean {
  return frame.milestoneDay == null || bestFlameDay >= frame.milestoneDay;
}

// ---- Pose prompts -------------------------------------------------------------

/** Solo prompts — one is offered before the countdown; skipping is always free. */
export const SOLO_PROMPTS: string[] = [
  "😎 Show me your “I survived today” face.",
  "🫣 Hide half of your face.",
  "🐱 Give me your cutest expression.",
  "😐 Now… your most serious face.",
  "🌞 The face you make when a good song comes on.",
  "🥱 Your honest 11pm face.",
  "✌️ Classic peace sign. No shame.",
];

/** Duo 4-shot prompts, in order — the same line shows on both phones. */
export const DUO_SHOT_PROMPTS: string[] = [
  "Smile. ♡",
  "Now be silly.",
  "Look at each other (yes, even from afar).",
  "One last one. Make it count.",
];

/** Prompt for a duo classic single shot. */
export const DUO_CLASSIC_PROMPT = "One frame, the two of us. ♡";

export function randomSoloPrompt(): string {
  return SOLO_PROMPTS[Math.floor(Math.random() * SOLO_PROMPTS.length)];
}

// ---- Capture & session constants ----------------------------------------------

/** Photos are captured as centre-cropped squares at this size. */
export const CAPTURE_SIZE = 1080;
/** Countdown before the shutter. */
export const COUNTDOWN_FROM = 3;
/** Duo session poll cadence (ms). */
export const BOOTH_POLL_MS = 2500;
/** Default album titles for keeping a finished strip. */
export const SOLO_ALBUM_TITLE = "My Photobooth";
export const DUO_ALBUM_TITLE = "Our Photobooth";
