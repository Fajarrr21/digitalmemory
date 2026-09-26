import { describe, it, expect } from "vitest";
import { computeFlame, prevDay, nextDay } from "./flame-logic";

const S = (...days: string[]) => new Set(days);

function range(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = nextDay(cur);
  }
  return out;
}

describe("prevDay / nextDay", () => {
  it("crosses month boundaries", () => {
    expect(prevDay("2026-10-01")).toBe("2026-09-30");
    expect(nextDay("2026-09-30")).toBe("2026-10-01");
  });
});

describe("computeFlame", () => {
  const today = "2026-09-26";

  it("is out with no presence at all", () => {
    const f = computeFlame({ today, you: S(), partner: S(), bridged: S() });
    expect(f.status).toBe("out");
    expect(f.streak).toBe(0);
    expect(f.restorable).toBeNull();
    expect(f.runs).toEqual([]);
  });

  it("is out (waiting for one more) when only one shows up on day 1", () => {
    const f = computeFlame({ today, you: S(today), partner: S(), bridged: S() });
    expect(f.status).toBe("out");
    expect(f.todayYou).toBe(true);
    expect(f.todayPartner).toBe(false);
  });

  it("lights Day 1 when both show up", () => {
    const f = computeFlame({ today, you: S(today), partner: S(today), bridged: S() });
    expect(f.status).toBe("lit");
    expect(f.streak).toBe(1);
    expect(f.runs).toEqual([{ start: today, end: today, length: 1 }]);
  });

  it("counts consecutive both-present days", () => {
    const days = range("2026-09-20", today);
    const f = computeFlame({ today, you: S(...days), partner: S(...days), bridged: S() });
    expect(f.status).toBe("lit");
    expect(f.streak).toBe(7);
  });

  it("waits when the flame is alive through yesterday but today is incomplete", () => {
    const days = range("2026-09-20", "2026-09-25");
    const f = computeFlame({
      today,
      you: S(...days, today), // you showed up today, partner not yet
      partner: S(...days),
      bridged: S(),
    });
    expect(f.status).toBe("waiting");
    expect(f.streak).toBe(6);
    expect(f.todayYou).toBe(true);
    expect(f.todayPartner).toBe(false);
  });

  it("goes quiet with a restorable one-day gap", () => {
    const days = range("2026-08-27", "2026-09-24"); // 29 days, gap on the 25th
    const f = computeFlame({ today, you: S(...days), partner: S(...days), bridged: S() });
    expect(f.status).toBe("quiet");
    expect(f.streak).toBe(0);
    expect(f.restorable).toEqual({ gapDay: "2026-09-25", priorStreak: 29 });
  });

  it("keeps the restorable offer even when a new spark started today", () => {
    const days = range("2026-09-20", "2026-09-24");
    const f = computeFlame({
      today,
      you: S(...days, today),
      partner: S(...days, today),
      bridged: S(),
    });
    expect(f.status).toBe("lit");
    expect(f.streak).toBe(1); // new spark
    expect(f.restorable).toEqual({ gapDay: "2026-09-25", priorStreak: 5 });
  });

  it("bridges a restored day: streak continues without counting the gap", () => {
    const days = [...range("2026-09-20", "2026-09-24"), today];
    const f = computeFlame({
      today,
      you: S(...days),
      partner: S(...days),
      bridged: S("2026-09-25"),
    });
    expect(f.status).toBe("lit");
    expect(f.streak).toBe(6); // 5 + today, bridged day adds nothing
    expect(f.restorable).toBeNull();
    // Bridged runs stay joined in history too.
    expect(f.runs).toEqual([{ start: "2026-09-20", end: today, length: 6 }]);
  });

  it("keeps waiting across a bridged yesterday", () => {
    const days = range("2026-09-20", "2026-09-24");
    const f = computeFlame({
      today,
      you: S(...days),
      partner: S(...days),
      bridged: S("2026-09-25"),
    });
    expect(f.status).toBe("waiting");
    expect(f.streak).toBe(5);
  });

  it("ends the flame after a 2+ day gap (no restore)", () => {
    const days = range("2026-09-01", "2026-09-23"); // gap 24th AND 25th
    const f = computeFlame({ today, you: S(...days), partner: S(...days), bridged: S() });
    expect(f.status).toBe("out");
    expect(f.restorable).toBeNull();
    expect(f.runs).toEqual([{ start: "2026-09-01", end: "2026-09-23", length: 23 }]);
  });

  it("keeps history: old run + current run", () => {
    const old = range("2026-09-01", "2026-09-10");
    const cur = range("2026-09-24", today);
    const f = computeFlame({
      today,
      you: S(...old, ...cur),
      partner: S(...old, ...cur),
      bridged: S(),
    });
    expect(f.status).toBe("lit");
    expect(f.streak).toBe(3);
    expect(f.runs).toEqual([
      { start: "2026-09-24", end: today, length: 3 },
      { start: "2026-09-01", end: "2026-09-10", length: 10 },
    ]);
  });

  it("ignores days where only one was present inside a gap", () => {
    const both = range("2026-09-20", "2026-09-24");
    const f = computeFlame({
      today,
      you: S(...both, "2026-09-25", today),
      partner: S(...both, today),
      bridged: S(),
    });
    // 25th had only you → still a hole → restorable, and today is a new spark.
    expect(f.streak).toBe(1);
    expect(f.restorable).toEqual({ gapDay: "2026-09-25", priorStreak: 5 });
  });
});
