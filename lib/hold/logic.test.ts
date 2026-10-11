import { describe, expect, it } from "vitest";
import {
  actionFit,
  allowedMoves,
  effectiveStatus,
  holdErrorMessage,
  holdWhatsAppEnabled,
  objectFor,
  objectState,
  orderedActions,
  shouldNotifyRecipient,
  shouldNotifySender,
} from "@/lib/hold/logic";
import type { HoldFeeling, HoldStatus } from "@/lib/supabase/database.types";

const NOW = new Date("2026-10-11T12:00:00Z");
const PAST = "2026-10-11T11:59:59Z";
const FUTURE = "2026-10-12T12:00:00Z";

describe("objectFor", () => {
  it("maps every feeling to one of the four objects", () => {
    const all: HoldFeeling[] = ["overwhelmed", "alone", "tired", "racing", "miss_you", "comfort"];
    expect(all.map(objectFor)).toEqual(["cloud", "star", "moon", "cloud", "star", "heart"]);
  });
});

describe("effectiveStatus", () => {
  it("expires sessions still waiting for support once the window passes", () => {
    for (const status of ["pending", "opened", "continued"] as HoldStatus[]) {
      expect(effectiveStatus({ status, expires_at: PAST }, NOW)).toBe("expired");
      expect(effectiveStatus({ status, expires_at: FUTURE }, NOW)).toBe(status);
    }
  });

  it("never expires a session that was answered or already ended", () => {
    for (const status of ["responded", "closed", "expired"] as HoldStatus[]) {
      expect(effectiveStatus({ status, expires_at: PAST }, NOW)).toBe(status);
    }
  });
});

describe("objectState", () => {
  it("follows the session lifecycle", () => {
    expect(objectState("pending")).toBe("waiting");
    expect(objectState("continued")).toBe("waiting");
    expect(objectState("responded")).toBe("held");
    expect(objectState("closed")).toBe("ended");
    expect(objectState("expired")).toBe("ended");
  });
});

describe("actionFit / orderedActions", () => {
  it("puts what was asked for first", () => {
    expect(orderedActions("stay")[0].action).toBe("stay");
    expect(orderedActions("loved")[0].action).toBe("warmth");
    expect(orderedActions("vent")[0].action).toBe("listening");
    expect(orderedActions("space")[0].action).toBe("space");
  });

  it("never offers 'I'm listening' to someone who asked for space", () => {
    expect(actionFit("space", "listening")).toBe("avoid");
    expect(orderedActions("space").map((a) => a.action)).not.toContain("listening");
    expect(orderedActions("space")).toHaveLength(3);
  });

  it("offers all four otherwise", () => {
    expect(orderedActions("stay")).toHaveLength(4);
    expect(orderedActions("vent")).toHaveLength(4);
  });
});

describe("allowedMoves", () => {
  it("lets only the recipient respond, and only while support is awaited", () => {
    expect(allowedMoves("recipient", "pending").respond).toBe(true);
    expect(allowedMoves("recipient", "opened").respond).toBe(true);
    expect(allowedMoves("recipient", "continued").respond).toBe(true);
    expect(allowedMoves("recipient", "responded").respond).toBe(false);
    expect(allowedMoves("recipient", "closed").respond).toBe(false);
    expect(allowedMoves("recipient", "expired").respond).toBe(false);
    expect(allowedMoves("sender", "pending").respond).toBe(false);
  });

  it("asks the sender 'what do you need now?' only after a gesture", () => {
    expect(allowedMoves("sender", "responded").after).toBe(true);
    expect(allowedMoves("sender", "pending").after).toBe(false);
    expect(allowedMoves("recipient", "responded").after).toBe(false);
  });

  it("lets the sender close a live session and keep an ended one", () => {
    expect(allowedMoves("sender", "pending").close).toBe(true);
    expect(allowedMoves("sender", "closed").close).toBe(false);
    expect(allowedMoves("sender", "closed").keep).toBe(true);
    expect(allowedMoves("sender", "expired").keep).toBe(true);
    expect(allowedMoves("recipient", "closed").keep).toBe(false);
  });
});

describe("notifications", () => {
  it("only sends the heads-up once, for 'soon', when not opted out", () => {
    expect(
      shouldNotifyRecipient({ timing: "soon", alreadyNotified: false, recipientOptedOut: false }),
    ).toBe(true);
    expect(
      shouldNotifyRecipient({ timing: "whenever", alreadyNotified: false, recipientOptedOut: false }),
    ).toBe(false);
    expect(
      shouldNotifyRecipient({ timing: "soon", alreadyNotified: true, recipientOptedOut: false }),
    ).toBe(false);
    expect(
      shouldNotifyRecipient({ timing: "soon", alreadyNotified: false, recipientOptedOut: true }),
    ).toBe(false);
  });

  it("never pings for 'gentle space'", () => {
    expect(shouldNotifySender("space", false)).toBe(false);
    expect(shouldNotifySender("stay", false)).toBe(true);
    expect(shouldNotifySender("warmth", true)).toBe(false);
  });

  it("defaults the WhatsApp preference to on", () => {
    expect(holdWhatsAppEnabled({})).toBe(true);
    expect(holdWhatsAppEnabled(null)).toBe(true);
    expect(holdWhatsAppEnabled({ hold_whatsapp: false })).toBe(false);
  });
});

describe("holdErrorMessage", () => {
  it("turns database refusals into kind words", () => {
    expect(holdErrorMessage("hold_already_responded")).toMatch(/sudah hadir/);
    expect(holdErrorMessage("hold_closed")).toMatch(/ditutup/);
    expect(holdErrorMessage("something else")).toMatch(/Coba lagi/);
  });
});
