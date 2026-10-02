import { describe, it, expect } from "vitest";
import {
  buildRoad,
  daysTogether,
  flameMilestoneDates,
  footprintsSince,
  groupLetters,
  journeyStats,
  type Footprint,
} from "./logic";

const fp = (id: string, kind: Footprint["kind"], date: string): Footprint => ({
  id,
  kind,
  date,
  label: null,
  byId: null,
  href: null,
});

describe("buildRoad", () => {
  it("orders chronologically, oldest first", () => {
    const road = buildRoad([
      fp("b", "memory", "2026-09-10"),
      fp("a", "letter", "2026-08-01"),
      fp("c", "watch", "2026-09-30"),
    ]);
    expect(road.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks same-day ties by kind so the start always leads", () => {
    const road = buildRoad([
      fp("w", "watch", "2026-08-01"),
      fp("s", "start", "2026-08-01"),
      fp("l", "letter", "2026-08-01"),
    ]);
    expect(road.map((f) => f.kind)).toEqual(["start", "letter", "watch"]);
  });

  it("keeps only the first of the first-only kinds", () => {
    const road = buildRoad([
      fp("r2", "rating", "2026-08-02"),
      fp("r1", "rating", "2026-08-01"),
      fp("r3", "rating", "2026-08-03"),
    ]);
    expect(road.map((f) => f.id)).toEqual(["r1"]);
    expect(road[0].first).toBe(true);
  });

  it("keeps every memory / letter, marking only the first", () => {
    const road = buildRoad([
      fp("m1", "memory", "2026-08-01"),
      fp("m2", "memory", "2026-08-05"),
      fp("l1", "letter", "2026-08-03"),
    ]);
    expect(road.map((f) => [f.id, f.first])).toEqual([
      ["m1", true],
      ["l1", true],
      ["m2", false],
    ]);
  });

  it("doesn't mutate its input", () => {
    const input = [fp("b", "memory", "2026-09-10"), fp("a", "memory", "2026-08-01")];
    buildRoad(input);
    expect(input.map((f) => f.id)).toEqual(["b", "a"]);
    expect(input[0].first).toBeUndefined();
  });

  it("an empty journey is an empty road", () => {
    expect(buildRoad([])).toEqual([]);
  });
});

describe("groupLetters", () => {
  it("a sequence sent at once is one footprint led by its first letter", () => {
    const groups = groupLetters([
      { id: "x2", batchId: "B", sortIndex: 1, date: "2026-08-01" },
      { id: "x1", batchId: "B", sortIndex: 0, date: "2026-08-01" },
      { id: "x3", batchId: "B", sortIndex: 2, date: "2026-08-01" },
      { id: "solo", batchId: null, sortIndex: 0, date: "2026-08-02" },
    ]);
    expect(groups).toHaveLength(2);
    const batch = groups.find((g) => g.count === 3)!;
    expect(batch.lead.id).toBe("x1");
    expect(groups.find((g) => g.lead.id === "solo")?.count).toBe(1);
  });

  it("two single letters never merge", () => {
    expect(
      groupLetters([
        { id: "a", batchId: null, sortIndex: 0, date: "2026-08-01" },
        { id: "b", batchId: null, sortIndex: 0, date: "2026-08-01" },
      ]),
    ).toHaveLength(2);
  });
});

describe("flameMilestoneDates", () => {
  const days = (start: string, n: number) => {
    const out: string[] = [];
    const d = new Date(`${start}T12:00:00Z`);
    for (let i = 0; i < n; i++) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  };

  it("finds the day each milestone was reached", () => {
    expect(flameMilestoneDates(days("2026-08-01", 10), [], [1, 3, 10, 30])).toEqual([
      { day: 1, date: "2026-08-01" },
      { day: 3, date: "2026-08-03" },
      { day: 10, date: "2026-08-10" },
    ]);
  });

  it("a missed day puts the streak out", () => {
    const flame = [...days("2026-08-01", 2), ...days("2026-08-04", 3)];
    // 1,2 · gap · 1,2,3 → day 3 is first reached on Aug 6, not Aug 3.
    expect(flameMilestoneDates(flame, [], [3])).toEqual([{ day: 3, date: "2026-08-06" }]);
  });

  it("a bridged day carries the streak without adding to it", () => {
    const flame = [...days("2026-08-01", 2), ...days("2026-08-04", 1)];
    expect(flameMilestoneDates(flame, ["2026-08-03"], [3])).toEqual([
      { day: 3, date: "2026-08-04" },
    ]);
  });

  it("reports each milestone only the first time", () => {
    const flame = [...days("2026-08-01", 3), ...days("2026-08-10", 3)];
    expect(flameMilestoneDates(flame, [], [3])).toEqual([{ day: 3, date: "2026-08-03" }]);
  });

  it("no flame days, no milestones", () => {
    expect(flameMilestoneDates([], [], [1, 3])).toEqual([]);
  });
});

describe("daysTogether", () => {
  it("counts both ends", () => {
    expect(daysTogether("2026-10-01", "2026-10-03")).toBe(3);
    expect(daysTogether("2026-10-03", "2026-10-03")).toBe(1);
  });
  it("crosses months and leap days", () => {
    expect(daysTogether("2028-02-28", "2028-03-01")).toBe(3);
  });
  it("is zero with no start or a start in the future", () => {
    expect(daysTogether(null, "2026-10-03")).toBe(0);
    expect(daysTogether("2026-12-01", "2026-10-03")).toBe(0);
  });
});

describe("footprintsSince", () => {
  it("keeps what was added on or after the day", () => {
    const road = [fp("a", "memory", "2026-09-01"), fp("b", "memory", "2026-09-28")];
    expect(footprintsSince(road, "2026-09-28").map((f) => f.id)).toEqual(["b"]);
  });
});

describe("journeyStats", () => {
  it("drops zeros and keeps a fixed reading order", () => {
    expect(journeyStats({ moments: 41, letters: 24, days: 87, watch: 0 })).toEqual([
      { key: "days", value: 87 },
      { key: "letters", value: 24 },
      { key: "moments", value: 41 },
    ]);
  });
  it("never shows a negative or fractional number", () => {
    expect(journeyStats({ days: -3, letters: 2.7 })).toEqual([{ key: "letters", value: 2 }]);
  });
});
