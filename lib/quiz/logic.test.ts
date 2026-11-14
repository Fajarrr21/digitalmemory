import { describe, expect, it } from "vitest";
import { QUESTIONS, QUIZ_SIZE } from "./config";
import { feedbackFor, optionsFor, randomOrder, scoreOf, sheetProblem, titleFor, winnerOf } from "./logic";

const full = () => Array.from({ length: QUIZ_SIZE }, (_, i) => ({ a: `a${i}`, d: [`x${i}`, `y${i}`, `z${i}`] }));

describe("quiz logic", () => {
  it("bank has 25 questions", () => expect(QUESTIONS).toHaveLength(QUIZ_SIZE));

  it("sheetProblem", () => {
    expect(sheetProblem(full())).toBeNull();
    const s = full();
    s[3].a = " ";
    expect(sheetProblem(s)).toMatch(/4/);
    const t = full();
    t[0].d[1] = " A0 ";
    expect(sheetProblem(t)).toMatch(/berbeda/);
  });

  it("randomOrder is a permutation and options map back", () => {
    for (let i = 0; i < 50; i++) {
      const o = randomOrder();
      expect([...o].sort()).toEqual([0, 1, 2, 3]);
      const { options, correctIdx } = optionsFor({ a: "A", d: ["B", "C", "D"] }, o);
      expect(options[correctIdx]).toBe("A");
      expect([...options].sort()).toEqual(["A", "B", "C", "D"]);
    }
  });

  it("score, streak, titles, winner", () => {
    const g = Array.from({ length: 25 }, (_, idx) => ({ idx, correct: idx < 22 }));
    const s = scoreOf(g);
    expect(s).toMatchObject({ right: 22, wrong: 3, points: 2200, pct: 88, streak: 22, title: "Si Paling Perhatian" });
    expect(titleFor(100)).toBe("Human Encyclopedia of Love");
    expect(titleFor(39)).toMatch(/Kenalan/);
    expect(winnerOf(22, 19)).toBe("me");
    expect(winnerOf(5, 5)).toBe("tie");
  });

  it("feedback is stable per seed", () => {
    expect(feedbackFor("savage", false, "g:1:u")).toEqual(feedbackFor("savage", false, "g:1:u"));
  });
});
