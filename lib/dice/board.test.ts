import { describe, expect, it } from "vitest";
import { BOARD_SIZE, HEARTS, LADDERS, SNAKES, cellOf, drawPrize, stepOn } from "./board";

describe("board layout", () => {
  it("never chains: no special square lands on another special square", () => {
    const special = new Set([...Object.keys(LADDERS).map(Number), ...Object.keys(SNAKES).map(Number), BOARD_SIZE]);
    for (const to of [...Object.values(LADDERS), ...Object.values(SNAKES)]) expect(special.has(to)).toBe(false);
    for (const h of HEARTS) expect(special.has(h)).toBe(false);
    for (const [a, b] of Object.entries(LADDERS)) expect(b).toBeGreaterThan(Number(a));
    for (const [a, b] of Object.entries(SNAKES)) expect(b).toBeLessThan(Number(a));
  });

  it("snakes up from bottom-left", () => {
    expect(cellOf(1)).toEqual({ col: 0, row: 4 });
    expect(cellOf(6)).toEqual({ col: 5, row: 4 });
    expect(cellOf(7)).toEqual({ col: 5, row: 3 });
    expect(cellOf(30)).toEqual({ col: 5, row: 0 });
  });
});

describe("stepOn", () => {
  it("resolves ladders, snakes, hearts, plain and finish", () => {
    expect(stepOn(0, 3)).toEqual({ landed: 3, to: 11, event: "ladder" });
    expect(stepOn(15, 2)).toEqual({ landed: 17, to: 6, event: "snake" });
    expect(stepOn(1, 4)).toEqual({ landed: 5, to: 5, event: "heart" });
    expect(stepOn(0, 1)).toEqual({ landed: 1, to: 1, event: "plain" });
    expect(stepOn(27, 6)).toEqual({ landed: 30, to: 30, event: "finish" });
  });
});

describe("drawPrize", () => {
  it("never repeats the one being swapped away", () => {
    const first = drawPrize(() => 0);
    expect(drawPrize(() => 0, first)).not.toBe(first);
  });
});
