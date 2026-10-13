import { describe, expect, it } from "vitest";
import {
  canCare,
  careErrorMessage,
  careWhatsAppEnabled,
  effectiveStatus,
  orbPhase,
  safetyLevel,
  shouldNotifySender,
  sipGently,
  suggestedCare,
  waitingForCarer,
} from "@/lib/care/logic";

const NOW = new Date("2026-10-13T12:00:00Z");
const PAST = "2026-10-13T11:59:59Z";
const FUTURE = "2026-10-14T12:00:00Z";

describe("safetyLevel", () => {
  it("any warning sign is urgent, whatever the severity says", () => {
    expect(safetyLevel({ severity: "mild", redFlags: ["repeated_vomiting"] })).toBe("urgent");
    expect(safetyLevel({ severity: null, redFlags: ["fainted"] })).toBe("urgent");
  });
  it("severe on its own asks for a check", () => {
    expect(safetyLevel({ severity: "severe", redFlags: [], symptoms: ["stomach"] })).toBe("check");
  });
  it("severe with nausea/vomiting is urgent — never waited out in an app", () => {
    expect(safetyLevel({ severity: "severe", redFlags: [], symptoms: ["stomach", "nausea"] })).toBe("urgent");
  });
  it("mild/moderate without warning signs stays quiet (which is not a claim that it's safe)", () => {
    expect(safetyLevel({ severity: "mild", redFlags: [] })).toBe("none");
    expect(safetyLevel({ severity: "moderate", redFlags: [], symptoms: ["nausea"] })).toBe("none");
  });
});

describe("sipGently", () => {
  it("only with nausea", () => {
    expect(sipGently(["nausea"])).toBe(true);
    expect(sipGently(["stomach"])).toBe(false);
    expect(sipGently(null)).toBe(false);
  });
});

describe("effectiveStatus", () => {
  it("a live session past its window is expired", () => {
    expect(effectiveStatus({ status: "open", expires_at: PAST }, NOW)).toBe("expired");
    expect(effectiveStatus({ status: "resting", expires_at: PAST }, NOW)).toBe("expired");
  });
  it("leaves the rest alone", () => {
    expect(effectiveStatus({ status: "open", expires_at: FUTURE }, NOW)).toBe("open");
    expect(effectiveStatus({ status: "closed", expires_at: PAST }, NOW)).toBe("closed");
  });
});

describe("orbPhase", () => {
  it("follows the session, symbolically", () => {
    expect(orbPhase(null, false)).toBe("idle");
    expect(orbPhase("open", false)).toBe("waiting");
    expect(orbPhase("open", true)).toBe("cared");
    expect(orbPhase("resting", true)).toBe("resting");
    expect(orbPhase("closed", true)).toBe("ended");
    expect(orbPhase("expired", false)).toBe("ended");
  });
});

describe("waitingForCarer", () => {
  const base = { status: "open" as const, expires_at: FUTURE, after_choice: null, after_at: null };
  it("before any care", () => {
    expect(waitingForCarer({ ...base, last_care_at: null }, NOW)).toBe(true);
  });
  it("not after care arrived", () => {
    expect(waitingForCarer({ ...base, last_care_at: "2026-10-13T10:00:00Z" }, NOW)).toBe(false);
  });
  it("again after 'a little longer' since the last care", () => {
    expect(
      waitingForCarer(
        { ...base, last_care_at: "2026-10-13T10:00:00Z", after_choice: "longer", after_at: "2026-10-13T11:00:00Z" },
        NOW,
      ),
    ).toBe(true);
  });
  it("never for an ended or expired session", () => {
    expect(waitingForCarer({ ...base, status: "closed", last_care_at: null }, NOW)).toBe(false);
    expect(waitingForCarer({ ...base, expires_at: PAST, last_care_at: null }, NOW)).toBe(false);
  });
});

describe("canCare", () => {
  it("anything while open", () => {
    expect(canCare("accompany", "open", false).ok).toBe(true);
    expect(canCare("message", "open", true).ok).toBe(true);
  });
  it("resting: no call/chat offers, one message only", () => {
    expect(canCare("accompany", "resting", false)).toEqual({ ok: false, reason: "resting" });
    expect(canCare("message", "resting", false).ok).toBe(true);
    expect(canCare("message", "resting", true)).toEqual({ ok: false, reason: "rest_note_used" });
    expect(canCare("gesture", "resting", true).ok).toBe(true);
    expect(canCare("help", "resting", true).ok).toBe(true);
  });
  it("nothing once ended", () => {
    expect(canCare("gesture", "closed", false)).toEqual({ ok: false, reason: "ended" });
  });
});

describe("suggestedCare", () => {
  it("maps wants to actions, no duplicates", () => {
    expect(suggestedCare(["warm", "drink", "stay"], false)).toEqual([
      { kind: "gesture", variant: "glow" },
      { kind: "help", variant: "drink" },
      { kind: "accompany", variant: "chat" },
    ]);
  });
  it("puts medical help first when they agreed to share it may need a check", () => {
    expect(suggestedCare(["quiet"], true)[0]).toEqual({ kind: "help", variant: "medical" });
  });
});

describe("shouldNotifySender", () => {
  const base = { first: true, kind: "gesture" as const, status: "open" as const, wants: ["warm" as const], alreadyNotified: false };
  it("once, on the first care", () => {
    expect(shouldNotifySender(base)).toBe(true);
    expect(shouldNotifySender({ ...base, first: false })).toBe(false);
    expect(shouldNotifySender({ ...base, alreadyNotified: true })).toBe(false);
  });
  it("never while resting, for quiet time, or for 'I'll let you rest'", () => {
    expect(shouldNotifySender({ ...base, status: "resting" })).toBe(false);
    expect(shouldNotifySender({ ...base, wants: ["quiet"] })).toBe(false);
    expect(shouldNotifySender({ ...base, kind: "rest" })).toBe(false);
  });
});

describe("prefs + errors", () => {
  it("WhatsApp is on unless turned off", () => {
    expect(careWhatsAppEnabled(null)).toBe(true);
    expect(careWhatsAppEnabled({ care_whatsapp: false })).toBe(false);
  });
  it("maps refusals", () => {
    expect(careErrorMessage("care_resting")).toMatch(/istirahat/);
    expect(careErrorMessage("boom")).toMatch(/tersendat/);
  });
});
