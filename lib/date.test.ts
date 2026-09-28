import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  formatInstant,
  localDateISO,
  localHour,
  zonedDateTimeToUTC,
} from "@/lib/date";
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

describe("wall-clock reminders", () => {
  it("pins a local date + time to the right instant", () => {
    // 19:00 in Jakarta (UTC+7) is 12:00 UTC.
    expect(zonedDateTimeToUTC("2026-09-29", "19:00", "Asia/Jakarta")).toBe(
      "2026-09-29T12:00:00.000Z",
    );
    expect(zonedDateTimeToUTC("2026-09-29", "19:00", "UTC")).toBe(
      "2026-09-29T19:00:00.000Z",
    );
  });

  it("renders an instant back in the user's own timezone", () => {
    expect(formatInstant("2026-09-29T12:00:00.000Z", "Asia/Jakarta")).toBe(
      "Sep 29 · 19:00",
    );
  });

  it("shifts plain calendar dates without timezone drift", () => {
    expect(addDaysISO("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
});
