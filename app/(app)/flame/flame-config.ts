/**
 * Our Little Flame — visual tiers + milestones.
 *
 * The flame *evolves*: not just a number, but size, colour, glow, particles.
 * Tiers are matched by streak (first row whose range contains it).
 *
 * Tone rule (important): never guilt, never countdown, never "don't break the
 * streak". TikTok says "don't break the streak" — this app says
 * "we both showed up today".
 */

export type FlameTier = {
  min: number;
  name: string;
  /** Overall scale of the flame visual (1 = base). */
  scale: number;
  /** Core / mid / outer flame colours (light→deep). */
  core: string;
  mid: string;
  outer: string;
  /** Glow colour (used with alpha). */
  glow: string;
  /** Rising particles. */
  particles: number;
  /** Gold sparkles ✨ for the highest tiers. */
  sparkle: boolean;
};

/** Ordered high→low; pick the first whose `min` fits. */
export const FLAME_TIERS: FlameTier[] = [
  { min: 200, name: "Eternal Flame", scale: 1.45, core: "#fff7e0", mid: "#ffd166", outer: "#f2637f", glow: "#ffd166", particles: 10, sparkle: true },
  { min: 100, name: "Radiant Flame", scale: 1.35, core: "#fff3d6", mid: "#ffc857", outer: "#f2637f", glow: "#ffc857", particles: 8, sparkle: true },
  { min: 50, name: "Blazing Flame", scale: 1.25, core: "#fff0cc", mid: "#ffab4a", outer: "#ef5d60", glow: "#ff9f45", particles: 7, sparkle: false },
  { min: 30, name: "Burning Flame", scale: 1.15, core: "#ffeec7", mid: "#ffa14a", outer: "#e85d4a", glow: "#ff9440", particles: 5, sparkle: false },
  { min: 7, name: "Warm Flame", scale: 1.0, core: "#ffedc2", mid: "#ff9e43", outer: "#e0653f", glow: "#ff9e43", particles: 4, sparkle: false },
  { min: 3, name: "Small Flame", scale: 0.85, core: "#ffebbd", mid: "#ff9a3d", outer: "#d96b3a", glow: "#ff9a3d", particles: 2, sparkle: false },
  { min: 1, name: "First Spark", scale: 0.7, core: "#ffe9b8", mid: "#ffab5c", outer: "#cf7a45", glow: "#ffab5c", particles: 1, sparkle: false },
];

export function tierFor(streak: number): FlameTier {
  return FLAME_TIERS.find((t) => streak >= t.min) ?? FLAME_TIERS[FLAME_TIERS.length - 1];
}

export type Milestone = { day: number; title: string; line: string };

/** Each milestone has its own voice — a Day 100 story should *feel* like 100. */
export const MILESTONES: Milestone[] = [
  { day: 1, title: "First Spark", line: "The first spark. Every little thing starts somewhere." },
  { day: 3, title: "Still Burning", line: "Three days already. And we're still here." },
  { day: 10, title: "Warm", line: "Ten little days. A little flame, getting warmer." },
  { day: 30, title: "Burning", line: "A whole month of showing up for each other." },
  { day: 50, title: "Blazing", line: "50 days. That's not just a number anymore." },
  { day: 100, title: "Radiant", line: "One hundred little days of showing up for each other." },
  { day: 150, title: "Still Here", line: "150 days. Somehow this little thing keeps burning." },
  { day: 200, title: "Eternal", line: "200 days. Some fires just don't go out." },
  { day: 365, title: "A Whole Year", line: "365 days. A whole year of choosing each other." },
];

/** The milestone hit exactly today (for the little celebration), if any. */
export function milestoneToday(streak: number): Milestone | null {
  return MILESTONES.find((m) => m.day === streak) ?? null;
}
