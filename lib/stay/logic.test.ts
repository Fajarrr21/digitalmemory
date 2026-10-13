import { describe, expect, it } from "vitest";
import {
  TABLE_SLOTS,
  arrangeTable,
  arrivedSince,
  giftProblem,
  latestComfort,
  presenceLight,
  shouldNotify,
  stayErrorMessage,
  stayWhatsAppEnabled,
} from "@/lib/stay/logic";

const g = (id: string, created: string, extra: Partial<{ opened_at: string | null; put_away_at: string | null; kind: "note" | "comfort"; body: string | null }> = {}) => ({
  id,
  kind: "note" as "note" | "comfort",
  body: "hi" as string | null,
  opened_at: null as string | null,
  put_away_at: null as string | null,
  created_at: created,
  ...extra,
});

describe("arrangeTable", () => {
  it("keeps unopened gifts on the table first, newest first", () => {
    const gifts = [
      g("old-opened", "2026-10-01", { opened_at: "2026-10-02" }),
      g("new-opened", "2026-10-09", { opened_at: "2026-10-09" }),
      g("unopened-old", "2026-10-03"),
      g("unopened-new", "2026-10-10"),
    ];
    const { table } = arrangeTable(gifts);
    expect(table.map((x) => x.id)).toEqual(["unopened-new", "unopened-old", "new-opened", "old-opened"]);
  });
  it("only TABLE_SLOTS fit; the rest + put-away ones go to the box", () => {
    const gifts = Array.from({ length: TABLE_SLOTS + 2 }, (_, i) => g(`g${i}`, `2026-10-${10 + i}`));
    gifts.push(g("away", "2026-10-30", { put_away_at: "2026-10-30" }));
    const { table, box } = arrangeTable(gifts);
    expect(table).toHaveLength(TABLE_SLOTS);
    expect(box.map((x) => x.id)).toEqual(["away", "g1", "g0"]);
  });
});

describe("presenceLight", () => {
  it("is honest about who is here", () => {
    expect(presenceLight({ partnerHere: true, unopened: 0 })).toBe("together");
    expect(presenceLight({ partnerHere: false, unopened: 2 })).toBe("warm");
    expect(presenceLight({ partnerHere: false, unopened: 0 })).toBe("quiet");
  });
});

describe("latestComfort", () => {
  it("picks the newest comfort message still out", () => {
    const gifts = [
      g("c1", "2026-10-01", { kind: "comfort", body: "one" }),
      g("c2", "2026-10-05", { kind: "comfort", body: "two" }),
      g("c3", "2026-10-09", { kind: "comfort", body: "three", put_away_at: "2026-10-10" }),
      g("n", "2026-10-11"),
    ];
    expect(latestComfort(gifts)?.id).toBe("c2");
    expect(latestComfort([g("n", "2026-10-11")])).toBeNull();
  });
});

describe("giftProblem", () => {
  it("validates each kind", () => {
    expect(giftProblem({ kind: "note", body: "   " })).toBe("empty");
    expect(giftProblem({ kind: "note", body: "x".repeat(1001) })).toBe("too_long");
    expect(giftProblem({ kind: "note", body: "hi love" })).toBeNull();
    expect(giftProblem({ kind: "comfort", body: "x".repeat(301) })).toBe("too_long");
    expect(giftProblem({ kind: "object", objectKind: "crane", body: "" })).toBeNull();
    expect(giftProblem({ kind: "object", objectKind: "crane", body: "x".repeat(141) })).toBe("too_long");
    expect(giftProblem({ kind: "voice", body: "", seconds: 0 })).toBe("no_voice");
    expect(giftProblem({ kind: "voice", body: "", seconds: 12 })).toBeNull();
  });
});

describe("arrivedSince", () => {
  it("only new, unopened gifts", () => {
    const gifts = [g("a", "2026-10-10T10:00:00Z"), g("b", "2026-10-10T12:00:00Z"), g("c", "2026-10-10T13:00:00Z", { opened_at: "x" })];
    expect(arrivedSince(gifts, "2026-10-10T11:00:00Z").map((x) => x.id)).toEqual(["b"]);
    expect(arrivedSince(gifts, null)).toEqual([]);
  });
});

describe("notifications", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  it("at most once every few hours, and never when turned off", () => {
    expect(shouldNotify({ lastNotifiedAt: null, now, optedOut: false })).toBe(true);
    expect(shouldNotify({ lastNotifiedAt: "2026-10-13T10:00:00Z", now, optedOut: false })).toBe(false);
    expect(shouldNotify({ lastNotifiedAt: "2026-10-13T08:00:00Z", now, optedOut: false })).toBe(true);
    expect(shouldNotify({ lastNotifiedAt: null, now, optedOut: true })).toBe(false);
    expect(stayWhatsAppEnabled({ stay_whatsapp: false })).toBe(false);
    expect(stayWhatsAppEnabled(null)).toBe(true);
  });
  it("maps refusals kindly", () => {
    expect(stayErrorMessage("stay_room_full")).toMatch(/penuh/);
    expect(stayErrorMessage("??")).toMatch(/tersendat/);
  });
});
