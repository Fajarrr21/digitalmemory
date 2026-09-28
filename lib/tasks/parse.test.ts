import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/lib/tasks/parse";

// 2026-09-28 is a Monday.
const TODAY = "2026-09-28";

describe("quick add — dates", () => {
  it("understands besok / lusa / hari ini", () => {
    expect(parseQuickAdd("PR matematika besok", TODAY).dueDate).toBe("2026-09-29");
    expect(parseQuickAdd("beli charger lusa", TODAY).dueDate).toBe("2026-09-30");
    expect(parseQuickAdd("kirim tugas hari ini", TODAY).dueDate).toBe(TODAY);
  });

  it("reads an explicit day + month name", () => {
    const t = parseQuickAdd("PR matematika dikumpulin tanggal 30 september", TODAY);
    expect(t.dueDate).toBe("2026-09-30");
    expect(t.title).toBe("PR matematika dikumpulin");
  });

  it("rolls a day+month that already passed into next year", () => {
    expect(parseQuickAdd("bayar tagihan 3 januari", TODAY).dueDate).toBe("2027-01-03");
  });

  it("reads numeric and ISO dates", () => {
    expect(parseQuickAdd("submit laporan 30/9", TODAY).dueDate).toBe("2026-09-30");
    expect(parseQuickAdd("rapat 1/10/2026", TODAY).dueDate).toBe("2026-10-01");
    expect(parseQuickAdd("ujian 2026-12-01", TODAY).dueDate).toBe("2026-12-01");
  });

  it("resolves weekday names forward, counting today as today", () => {
    expect(parseQuickAdd("beli notebook sabtu", TODAY).dueDate).toBe("2026-10-03");
    expect(parseQuickAdd("beli notebook sabtu depan", TODAY).dueDate).toBe("2026-10-10");
    expect(parseQuickAdd("kelas senin", TODAY).dueDate).toBe(TODAY);
  });

  it("falls back to today when it understands nothing", () => {
    const t = parseQuickAdd("beresin kamar", TODAY);
    expect(t.dueDate).toBe(TODAY);
    expect(t.matched.date).toBe(false);
    expect(t.title).toBe("Beresin kamar");
  });
});

describe("quick add — times", () => {
  it("reads jam 8 literally and jam 8 malam as evening", () => {
    expect(parseQuickAdd("presentasi besok jam 8", TODAY).dueTime).toBe("08:00");
    expect(parseQuickAdd("telfon dia jam 8 malam", TODAY).dueTime).toBe("20:00");
    expect(parseQuickAdd("meeting jam 4 sore", TODAY).dueTime).toBe("16:00");
  });

  it("reads clock forms", () => {
    expect(parseQuickAdd("kumpul tugas jam 19.00", TODAY).dueTime).toBe("19:00");
    expect(parseQuickAdd("kereta 07:45 besok", TODAY).dueTime).toBe("07:45");
  });

  it("keeps the date and the time apart", () => {
    const t = parseQuickAdd("besok jam 8 ada tugas presentasi kelompok", TODAY);
    expect(t.dueDate).toBe("2026-09-29");
    expect(t.dueTime).toBe("08:00");
    expect(t.title).toBe("Tugas presentasi kelompok");
  });
});

describe("quick add — title and icon", () => {
  it("peels off filler words", () => {
    expect(parseQuickAdd("jangan lupa beli charger besok", TODAY).title).toBe(
      "Beli charger",
    );
    expect(parseQuickAdd("ingetin aku harus bayar kos", TODAY).title).toBe(
      "Bayar kos",
    );
  });

  it("guesses a little icon from what the thing is", () => {
    expect(parseQuickAdd("PR fisika besok", TODAY).emoji).toBe("\u{1F4DA}");
    expect(parseQuickAdd("beli kado", TODAY).emoji).toBe("\u{1F6CD}️");
    expect(parseQuickAdd("ngobrol sama mama", TODAY).emoji).toBe("\u{1F4DD}");
  });

  it("never returns an empty title", () => {
    expect(parseQuickAdd("besok", TODAY).title.length).toBeGreaterThan(0);
  });
});
