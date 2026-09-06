import { describe, expect, it } from "vitest";
import { localDateISO, localHour } from "@/lib/date";
import { daypart, greeting } from "@/lib/greeting";

describe("timezone-aware date", () => {
  it("resolves the calendar date in the user's timezone, not UTC", () => {
    // 2026-09-06T18:30:00Z is already Sep 7 in Jakarta (UTC+7 → 01:30).
    const at = new Date("2026-09-06T18:30:00Z");
    expect(localDateISO("Asia/Jakarta", at)).toBe("2026-09-07");
    expect(localDateISO("UTC", at)).toBe("2026-09-06");
  });

  it("gives the local hour used by the greeting", () => {
    const at = new Date("2026-09-06T22:00:00Z"); // 05:00 Jakarta
    expect(localHour("Asia/Jakarta", at)).toBe(5);
  });

  it("falls back gracefully when timezone is missing", () => {
    expect(localDateISO(null, new Date("2026-09-06T05:00:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});

describe("greeting", () => {
  it("maps hours to dayparts", () => {
    expect(daypart(7)).toBe("morning");
    expect(daypart(14)).toBe("afternoon");
    expect(daypart(19)).toBe("evening");
    expect(daypart(23)).toBe("night");
    expect(daypart(3)).toBe("night");
  });

  it("uses the nickname in the morning and evening", () => {
    expect(greeting(8, "beautiful")).toContain("beautiful");
    expect(greeting(20, "love")).toContain("love");
  });
});
