import { describe, expect, it } from "vitest";
import { MOON_WHATSAPP_TEXT, inAppDue, reminderTitle, validTime, whatsappDue, type Reminder } from "@/lib/moon/reminders";

const r = (extra: Partial<Reminder> = {}): Reminder => ({
  id: "r",
  kind: "checkin",
  label: null,
  at_time: "20:00:00",
  enabled: true,
  whatsapp: true,
  dismissed_on: null,
  sent_on: null,
  ...extra,
});
const today = "2026-10-13";

describe("inAppDue", () => {
  it("from its time onward, until dismissed that day", () => {
    expect(inAppDue(r(), today, "19:59", false)).toBe(false);
    expect(inAppDue(r(), today, "20:00", false)).toBe(true);
    expect(inAppDue(r(), today, "23:40", false)).toBe(true);
    expect(inAppDue(r({ dismissed_on: today }), today, "21:00", false)).toBe(false);
    expect(inAppDue(r({ dismissed_on: "2026-10-12" }), today, "21:00", false)).toBe(true);
  });
  it("a check-in reminder disappears once she checked in", () => {
    expect(inAppDue(r(), today, "21:00", true)).toBe(false);
    expect(inAppDue(r({ kind: "period" }), today, "21:00", true)).toBe(true);
  });
  it("off means off", () => {
    expect(inAppDue(r({ enabled: false }), today, "21:00", false)).toBe(false);
  });
});

describe("whatsappDue", () => {
  it("once a day, only when opted in, never hours stale", () => {
    expect(whatsappDue(r(), today, "20:05", false)).toBe(true);
    expect(whatsappDue(r({ sent_on: today }), today, "20:05", false)).toBe(false);
    expect(whatsappDue(r({ whatsapp: false }), today, "20:05", false)).toBe(false);
    expect(whatsappDue(r({ at_time: "08:00" }), today, "20:05", false)).toBe(false);
    expect(whatsappDue(r(), today, "19:00", false)).toBe(false);
  });
});

describe("copy", () => {
  it("the WhatsApp text never says anything about periods or symptoms", () => {
    expect(MOON_WHATSAPP_TEXT).not.toMatch(/menstru|haid|period|siklus|kram|mens/i);
  });
  it("custom reminders use her own words in-app", () => {
    expect(reminderTitle({ kind: "custom", label: "minum air putih" })).toBe("minum air putih");
  });
  it("validates HH:MM", () => {
    expect(validTime("07:30")).toBe(true);
    expect(validTime("24:00")).toBe(false);
    expect(validTime("7:30")).toBe(false);
  });
});
