import { describe, expect, it } from "vitest";
import {
  cycleChanges,
  cycleStartFor,
  duringVsOther,
  isEmptyCheckin,
  moodCounts,
  needsCareNote,
  repeatedVomiting,
  symptomFrequency,
  type Checkin,
} from "@/lib/moon/insights";
import type { Period } from "@/lib/moon/cycle";

// Synthetic data only.
const blank = { cramps: null, headache: false, nausea: false, vomiting: false, fatigue: false, mood: null, energy: null, flow: null, note: null };
const c = (day: string, extra: Partial<Checkin> = {}): Checkin => ({ day, ...blank, ...extra });
const periods: Period[] = [
  { id: "1", start: "2026-09-01", end: "2026-09-05" },
  { id: "2", start: "2026-10-01", end: "2026-10-05" },
];

describe("symptomFrequency + moods", () => {
  it("counts only what was logged, most frequent first", () => {
    const xs = [c("2026-10-01", { cramps: 2, fatigue: true }), c("2026-10-02", { cramps: 1 }), c("2026-10-03", { headache: true, mood: "sad" }), c("2026-10-04", { mood: "sad" })];
    expect(symptomFrequency(xs).map((x) => [x.symptom, x.count])).toEqual([["cramps", 2], ["headache", 1], ["fatigue", 1]]);
    expect(moodCounts(xs)).toEqual([{ mood: "sad", count: 2 }]);
  });
});

describe("cycleStartFor", () => {
  it("assigns a day to the latest period start on or before it", () => {
    expect(cycleStartFor("2026-09-20", periods)).toBe("2026-09-01");
    expect(cycleStartFor("2026-10-01", periods)).toBe("2026-10-01");
    expect(cycleStartFor("2026-08-20", periods)).toBeNull();
  });
});

describe("cycleChanges", () => {
  it("compares this cycle with the last one only when both have enough check-ins", () => {
    const prev = [c("2026-09-01", { cramps: 3 }), c("2026-09-02", { cramps: 2 }), c("2026-09-10", { headache: true })];
    const cur = [c("2026-10-01", { cramps: 1 }), c("2026-10-02"), c("2026-10-03", { headache: true, note: "x" })].map((x) =>
      x.cramps === null && !x.headache ? { ...x, fatigue: true } : x,
    );
    const changes = cycleChanges([...prev, ...cur], periods)!;
    expect(changes.find((x) => x.symptom === "cramps")).toEqual({ symptom: "cramps", previous: 2, current: 1 });
    expect(cycleChanges(cur, periods)).toBeNull();
    expect(cycleChanges(cur, periods.slice(0, 1))).toBeNull();
  });
});

describe("duringVsOther", () => {
  it("needs enough days on both sides", () => {
    const xs = [
      c("2026-10-01", { cramps: 2 }),
      c("2026-10-02", { cramps: 2 }),
      c("2026-10-03", { fatigue: true }),
      c("2026-10-10", { headache: true }),
      c("2026-10-11", { fatigue: true }),
      c("2026-10-12", { fatigue: true }),
    ];
    const r = duringVsOther(xs, periods, "2026-10-13")!;
    expect(r.find((x) => x.symptom === "cramps")).toEqual({ symptom: "cramps", during: 2 / 3, other: 0 });
    expect(duringVsOther(xs.slice(0, 4), periods, "2026-10-13")).toBeNull();
  });
});

describe("safety notes", () => {
  it("strong cramps or vomiting → a calm note", () => {
    expect(needsCareNote({ cramps: 3, vomiting: false })).toBe(true);
    expect(needsCareNote({ cramps: null, vomiting: true })).toBe(true);
    expect(needsCareNote({ cramps: 2, vomiting: false })).toBe(false);
  });
  it("repeated vomiting across recent check-ins → a firmer one", () => {
    expect(repeatedVomiting([c("2026-10-12", { vomiting: true }), c("2026-10-11", { vomiting: true }), c("2026-10-01")])).toBe(true);
    expect(repeatedVomiting([c("2026-10-12", { vomiting: true }), c("2026-10-11"), c("2026-10-10")])).toBe(false);
  });
});

describe("isEmptyCheckin", () => {
  it("a note alone is enough; whitespace isn't", () => {
    expect(isEmptyCheckin({ ...blank })).toBe(true);
    expect(isEmptyCheckin({ ...blank, note: "  " })).toBe(true);
    expect(isEmptyCheckin({ ...blank, note: "capek" })).toBe(false);
    expect(isEmptyCheckin({ ...blank, energy: 1 })).toBe(false);
  });
});
