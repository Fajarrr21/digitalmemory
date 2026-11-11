import { describe, expect, it } from "vitest";
import { adoreWhatsAppDue, adoreWhatsAppPerDay, effectiveStatus, isAvailable, milestoneProgress, noteNumber, pickSurprise, randomOther, readerOrder, thousandNumber } from "./logic";

const now = new Date("2026-11-11T12:00:00Z");

describe("adore logic", () => {
  it("derives scheduled from a future publish_at", () => {
    expect(effectiveStatus({ status: "published", publish_at: "2026-11-12T00:00:00Z" }, now)).toBe("scheduled");
    expect(effectiveStatus({ status: "published", publish_at: "2026-11-10T00:00:00Z" }, now)).toBe("published");
    expect(effectiveStatus({ status: "draft", publish_at: "2026-11-10T00:00:00Z" }, now)).toBe("draft");
    expect(isAvailable({ status: "archived", publish_at: "2026-11-10T00:00:00Z" }, now)).toBe(false);
  });

  it("orders oldest first, created_at breaks ties", () => {
    const rows = [
      { id: "b", status: "published" as const, publish_at: "2026-11-02", created_at: "2" },
      { id: "c", status: "published" as const, publish_at: "2026-11-01", created_at: "3" },
      { id: "a", status: "published" as const, publish_at: "2026-11-01", created_at: "1" },
    ];
    expect(readerOrder(rows).map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("numbers and randomises", () => {
    expect(noteNumber(0)).toBe("01");
    expect(noteNumber(99)).toBe("100");
    expect(randomOther(1, 0)).toBe(0);
    for (let i = 0; i < 50; i++) expect(randomOther(3, 1, () => i / 50)).not.toBe(1);
  });
});

describe("surprise pool", () => {
  const p = (id: string, opened: boolean, repeat = true) => ({ id, opened_at: opened ? "x" : null, repeat_allowed: repeat });

  it("prefers unopened, then repeatable, never the last one when avoidable", () => {
    expect(pickSurprise([p("a", true), p("b", false)], null)?.id).toBe("b");
    expect(pickSurprise([p("a", true, false), p("b", true)], null)?.id).toBe("b");
    expect(pickSurprise([p("a", true, false)], null)).toBeNull();
    expect(pickSurprise([], null)).toBeNull();
    for (let i = 0; i < 10; i++) expect(pickSurprise([p("a", false), p("b", false)], "a", () => i / 10)?.id).toBe("b");
    expect(pickSurprise([p("a", true)], "a")?.id).toBe("a");
  });

  it("tracks milestones", () => {
    expect(milestoneProgress(0)).toEqual({ reached: [], next: 10 });
    expect(milestoneProgress(37)).toEqual({ reached: [10, 25], next: 50 });
    expect(milestoneProgress(1200).next).toBeNull();
    expect(thousandNumber(7)).toBe("007");
  });
});

describe("favorite notification whatsapp", () => {
  const now = new Date("2026-11-11T12:00:00Z");
  it("needs opt-in, respects the cap, skips stale or future", () => {
    expect(adoreWhatsAppDue(0, 0, "2026-11-11T11:00:00Z", now)).toBe(false);
    expect(adoreWhatsAppDue(1, 0, "2026-11-11T11:00:00Z", now)).toBe(true);
    expect(adoreWhatsAppDue(1, 1, "2026-11-11T11:00:00Z", now)).toBe(false);
    expect(adoreWhatsAppDue(3, 0, "2026-11-09T11:00:00Z", now)).toBe(false);
    expect(adoreWhatsAppDue(3, 0, "2026-11-11T13:00:00Z", now)).toBe(false);
  });
  it("reads prefs safely", () => {
    expect(adoreWhatsAppPerDay(undefined)).toBe(0);
    expect(adoreWhatsAppPerDay({ adore_whatsapp_per_day: 2 })).toBe(2);
    expect(adoreWhatsAppPerDay({ adore_whatsapp_per_day: 99 })).toBe(3);
    expect(adoreWhatsAppPerDay({ adore_whatsapp_per_day: "x" })).toBe(0);
  });
});
