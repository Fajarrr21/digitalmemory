import { describe, expect, it } from "vitest";
import { REEL, STORY_ACTS, STORY_MEDIA_KEYS, STORY_MOMENTS } from "./story-config";

describe("cerita awal kita (story-config)", () => {
  it("setiap momen punya bagian yang ada, id-nya unik", () => {
    const acts = new Set(STORY_ACTS.map((a) => a.id));
    for (const m of STORY_MOMENTS) expect(acts.has(m.act)).toBe(true);
    const ids = STORY_MOMENTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("momen tetap urut per bagian (Instagram → Instagram kedua → WhatsApp)", () => {
    const order = STORY_ACTS.map((a) => a.id);
    const seen = STORY_MOMENTS.map((m) => order.indexOf(m.act));
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it("tidak pernah memuat nomor HP", () => {
    const text = JSON.stringify([STORY_ACTS, STORY_MOMENTS, REEL]);
    // 08xx / +62 dengan atau tanpa pemisah, 9+ digit.
    expect(text).not.toMatch(/(\+?62|0)8[\d\s.-]{8,}/);
  });

  it("media hanya di folder journey-story/", () => {
    for (const k of STORY_MEDIA_KEYS) expect(k.startsWith("journey-story/")).toBe(true);
  });
});
