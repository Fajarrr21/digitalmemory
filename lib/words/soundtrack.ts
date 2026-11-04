/**
 * little words. — its soundtrack: two hand-picked moments, played in turn
 * and looped, quietly, while you write. Only the chosen part of each song
 * plays (start → end), fading in and out so the seams don't jar.
 * Pure + tested (soundtrack.test.ts); the player lives in
 * components/words/words-music.tsx.
 */

export type Segment = {
  youtubeId: string;
  title: string;
  artist: string;
  /** Seconds into the video. */
  start: number;
  end: number;
};

export const WORDS_SONGS: Segment[] = [
  { youtubeId: "3rf16_Q77WQ", title: "Ah", artist: "Nadin Amizah", start: 52, end: 103 }, // 0:52 – 1:43
  { youtubeId: "2uJut6USftQ", title: "Jatuh Suka", artist: "Tulus", start: 51, end: 90 }, // 0:51 – 1:30
];

export const FADE_IN = 2;
export const FADE_OUT = 3;
export const MAX_VOLUME = 70;

export function nextIndex(i: number, total = WORDS_SONGS.length): number {
  return total ? (i + 1) % total : 0;
}

/** Volume (0–MAX) at playback time `t` inside a segment: fade in, hold, fade out. */
export function volumeAt(t: number, seg: Pick<Segment, "start" | "end">, max = MAX_VOLUME): number {
  if (t <= seg.start) return 0;
  if (t >= seg.end) return 0;
  const intoIn = (t - seg.start) / FADE_IN;
  const intoOut = (seg.end - t) / FADE_OUT;
  return Math.round(max * Math.max(0, Math.min(1, intoIn, intoOut)));
}

/** True once the segment is over (with a small allowance for coarse polling). */
export function segmentDone(t: number, seg: Pick<Segment, "end">): boolean {
  return t >= seg.end - 0.15;
}

export function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
