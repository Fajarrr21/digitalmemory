import { describe, expect, it } from "vitest";
import { dayKind, diffDays, headsUpToday, looksForgotten, periodProblem, summarize, type Period } from "@/lib/moon/cycle";

// Synthetic data only — never anyone's real cycle.
const p = (id: string, start: string, end: string | null): Period => ({ id, start, end });

describe("diffDays", () => {
  it("counts calendar days, across months and leap years", () => {
    expect(diffDays("2026-01-30", "2026-02-02")).toBe(3);
    expect(diffDays("2028-02-28", "2028-03-01")).toBe(2);
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2); // no DST surprises
  });
});

describe("summarize — no data / one period", () => {
  it("nothing logged → nothing predicted", () => {
    const s = summarize([], "2026-10-13");
    expect(s.prediction).toBeNull();
    expect(s.cycleDay).toBeNull();
    expect(s.dataPoints).toBe(0);
  });
  it("one period → cycle day, but no prediction (no 28-day default)", () => {
    const s = summarize([p("a", "2026-10-01", "2026-10-05")], "2026-10-13");
    expect(s.cycleDay).toBe(13);
    expect(s.avgPeriod).toBe(5);
    expect(s.avgCycle).toBeNull();
    expect(s.prediction).toBeNull();
  });
});

describe("summarize — regular history", () => {
  const regular = [
    p("1", "2026-06-01", "2026-06-05"),
    p("2", "2026-07-01", "2026-07-05"), // 30 days
    p("3", "2026-07-31", "2026-08-04"), // 30
    p("4", "2026-08-30", "2026-09-03"), // 30
    p("5", "2026-09-29", "2026-10-03"), // 30
  ];
  it("averages from her own cycles, not 28", () => {
    const s = summarize(regular, "2026-10-13");
    expect(s.avgCycle).toBe(30);
    expect(s.avgPeriod).toBe(5);
    expect(s.varied).toBe(false);
    expect(s.prediction?.start).toBe("2026-10-29");
    expect(s.prediction?.confidence).toBe("steady");
    expect(s.prediction?.days).toEqual({ from: "2026-10-29", to: "2026-11-02" });
    expect(s.cycleDay).toBe(15);
    expect(s.onPeriod).toBe(false);
  });
  it("is honest when there are only two periods", () => {
    const s = summarize(regular.slice(0, 2), "2026-07-10");
    expect(s.prediction?.confidence).toBe("low");
    expect(s.prediction?.windowFrom).toBe("2026-07-27");
    expect(s.prediction?.windowTo).toBe("2026-08-04");
  });
});

describe("summarize — irregular cycles", () => {
  const irregular = [
    p("1", "2026-03-01", "2026-03-06"),
    p("2", "2026-03-25", "2026-03-30"), // 24
    p("3", "2026-05-02", "2026-05-06"), // 38
    p("4", "2026-06-01", "2026-06-05"), // 30
    p("5", "2026-07-05", "2026-07-09"), // 34
  ];
  it("marks a varied pattern and widens the window instead of pretending", () => {
    const s = summarize(irregular, "2026-07-20");
    expect(s.range).toEqual({ min: 24, max: 38 });
    expect(s.varied).toBe(true);
    expect(s.avgCycle).toBe(32);
    expect(s.prediction?.confidence).toBe("varied");
    expect(diffDays(s.prediction!.windowFrom, s.prediction!.windowTo)).toBe(14);
  });
  it("leaves implausible gaps (a missed log) out of the averages", () => {
    const s = summarize([p("1", "2026-01-01", "2026-01-05"), p("2", "2026-05-01", "2026-05-05"), p("3", "2026-05-30", "2026-06-03")], "2026-06-10");
    expect(s.cycles.map((c) => c.counted)).toEqual([false, true]);
    expect(s.avgCycle).toBe(29);
  });
});

describe("summarize — ongoing + late", () => {
  it("an ongoing period means on period, day N", () => {
    const s = summarize([p("1", "2026-09-10", "2026-09-14"), p("2", "2026-10-11", null)], "2026-10-13");
    expect(s.onPeriod).toBe(true);
    expect(s.cycleDay).toBe(3);
    expect(dayKind("2026-10-13", s, "2026-10-13")).toBe("period");
  });
  it("says how late, and never stacks a new guess", () => {
    const s = summarize([p("1", "2026-08-01", "2026-08-05"), p("2", "2026-08-31", "2026-09-04")], "2026-10-05");
    expect(s.prediction?.start).toBe("2026-09-30");
    expect(s.prediction?.daysLate).toBe(5);
  });
  it("flags a period that has been 'still going' suspiciously long", () => {
    const s = summarize([p("1", "2026-09-20", null)], "2026-10-13");
    expect(looksForgotten(s, "2026-10-13")).toBe(true);
  });
});

describe("dayKind", () => {
  const s = summarize([p("1", "2026-09-01", "2026-09-05"), p("2", "2026-10-01", "2026-10-05")], "2026-10-13");
  it("logged beats predicted, predictions only from today on", () => {
    expect(dayKind("2026-10-03", s, "2026-10-13")).toBe("period");
    expect(dayKind("2026-10-31", s, "2026-10-13")).toBe("predicted");
    expect(dayKind("2026-10-28", s, "2026-10-13")).toBe("window");
    expect(dayKind("2026-10-10", s, "2026-10-13")).toBeNull();
  });
});

describe("periodProblem", () => {
  const today = "2026-10-13";
  const existing = [p("a", "2026-09-01", "2026-09-05"), p("b", "2026-10-10", null)];
  it("rejects future dates and bad order", () => {
    expect(periodProblem({ start: "2026-10-20", end: null }, [], today)).toBe("future_start");
    expect(periodProblem({ start: "2026-10-01", end: "2026-10-20" }, [], today)).toBe("future_end");
    expect(periodProblem({ start: "2026-10-05", end: "2026-10-01" }, [], today)).toBe("end_before_start");
    expect(periodProblem({ start: "2026-08-01", end: "2026-08-30" }, [], today)).toBe("too_long");
  });
  it("rejects overlaps, including with an ongoing period", () => {
    expect(periodProblem({ start: "2026-09-04", end: "2026-09-07" }, existing, today)).toBe("overlap");
    expect(periodProblem({ start: "2026-10-11", end: "2026-10-12" }, existing, today)).toBe("overlap");
    expect(periodProblem({ start: "2026-09-20", end: null }, existing, today)).toBe("ongoing_exists");
  });
  it("allows editing a period in place, and non-overlapping history", () => {
    expect(periodProblem({ id: "a", start: "2026-09-02", end: "2026-09-06" }, existing, today)).toBeNull();
    expect(periodProblem({ start: "2026-08-01", end: "2026-08-05" }, existing, today)).toBeNull();
  });
});

describe("headsUpToday", () => {
  const s = summarize([p("1", "2026-09-01", "2026-09-05"), p("2", "2026-10-01", "2026-10-05")], "2026-10-30");
  it("only the day before and the expected day", () => {
    expect(headsUpToday(s, "2026-10-30")).toBe(true);
    expect(headsUpToday(summarize(s.periods, "2026-10-31"), "2026-10-31")).toBe(true);
    expect(headsUpToday(summarize(s.periods, "2026-10-25"), "2026-10-25")).toBe(false);
  });
});
