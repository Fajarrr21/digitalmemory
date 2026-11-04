import { describe, expect, it } from "vitest";
import { MAX_VOLUME, WORDS_SONGS, fmt, nextIndex, segmentDone, volumeAt } from "./soundtrack";

describe("little words soundtrack", () => {
  it("plays exactly the chosen parts", () => {
    expect(WORDS_SONGS.map((s) => [s.youtubeId, fmt(s.start), fmt(s.end)])).toEqual([
      ["3rf16_Q77WQ", "0:52", "1:43"],
      ["2uJut6USftQ", "0:51", "1:30"],
    ]);
    for (const s of WORDS_SONGS) expect(s.end).toBeGreaterThan(s.start);
  });

  it("loops back to the first song", () => {
    expect(nextIndex(0)).toBe(1);
    expect(nextIndex(1)).toBe(0);
  });

  it("fades in, holds, fades out", () => {
    const seg = { start: 52, end: 103 };
    expect(volumeAt(52, seg)).toBe(0);
    expect(volumeAt(53, seg)).toBe(Math.round(MAX_VOLUME / 2));
    expect(volumeAt(70, seg)).toBe(MAX_VOLUME);
    expect(volumeAt(101.5, seg)).toBe(Math.round(MAX_VOLUME / 2));
    expect(volumeAt(103, seg)).toBe(0);
    expect(volumeAt(200, seg)).toBe(0);
  });

  it("knows when a segment is over", () => {
    expect(segmentDone(102, { end: 103 })).toBe(false);
    expect(segmentDone(102.9, { end: 103 })).toBe(true);
  });
});
