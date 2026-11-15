import { describe, expect, it } from "vitest";
import { BANK, CATEGORIES, MODES } from "./config";
import { dealCards, drawWild, faceFrom, poolFor, type CustomChallenge } from "./logic";

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("bank", () => {
  it("has ≥15 per category and every mode in every category", () => {
    for (const c of CATEGORIES) {
      const inCat = BANK.filter((b) => b.category === c.key);
      expect(inCat.length).toBeGreaterThanOrEqual(15);
      for (const m of MODES) expect(inCat.some((b) => b.modes.includes(m.key)), `${c.key}/${m.key}`).toBe(true);
    }
    expect(new Set(BANK.map((b) => b.text)).size).toBe(BANK.length);
  });
});

describe("faceFrom", () => {
  it("maps [0,1) evenly onto 1..6", () => {
    expect([0, 0.17, 0.34, 0.5, 0.67, 0.84, 0.9999].map((r) => faceFrom(() => r))).toEqual([1, 2, 3, 4, 5, 6, 6]);
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[faceFrom(() => (i + 0.5) / 6000) - 1]++;
    expect(counts).toEqual([1000, 1000, 1000, 1000, 1000, 1000]);
  });
});

describe("drawWild", () => {
  it("is rare and picks one of four", () => {
    expect(drawWild(() => 0.5)).toBeNull();
    expect(drawWild(seq(0.01, 0))).toBe("switch");
    expect(drawWild(seq(0.01, 0.99))).toBe("heart");
  });
});

describe("dealCards", () => {
  const custom: CustomChallenge = {
    id: "x1",
    author_id: "A",
    category: "sweet",
    modes: ["deep"],
    kind: "a",
    text: "rahasia",
    secret: true,
  };

  it("deals a partner's custom challenge only to the other player", () => {
    expect(poolFor("sweet", "B", [custom]).some((p) => p.card.key === "c:x1")).toBe(true);
    expect(poolFor("sweet", "A", [custom]).some((p) => p.card.key === "c:x1")).toBe(false);
  });

  it("prefers unseen challenges in the chosen mode, never two of the same at once", () => {
    const pool = poolFor("deep", "A", []);
    const chaos = pool.filter((p) => p.modes.includes("chaos")).map((p) => p.card.key);
    const seen = chaos.slice(1);
    const [card] = dealCards(pool, "chaos", seen, () => 0);
    expect(card.key).toBe(chaos[0]);
    const two = dealCards(pool, "soft", [], () => 0, 2);
    expect(two[0].key).not.toBe(two[1].key);
  });

  it("falls back to other modes, then repeats, when a pool runs dry", () => {
    const pool = poolFor("deep", "A", []);
    const chaos = pool.filter((p) => p.modes.includes("chaos")).map((p) => p.card.key);
    const [other] = dealCards(pool, "chaos", chaos, () => 0);
    expect(chaos).not.toContain(other.key);
    const all = pool.map((p) => p.card.key);
    const [again] = dealCards(pool, "chaos", all, () => 0);
    expect(chaos).toContain(again.key);
  });
});
