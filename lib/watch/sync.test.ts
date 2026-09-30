import { describe, expect, it } from "vitest";
import {
  claimAt,
  clampToDuration,
  expectedPosition,
  formatClock,
  isControllable,
  minutesTogether,
  seekFromRatio,
  shouldResync,
  type PlaybackState,
} from "./sync";

const T0 = Date.UTC(2026, 8, 30, 20, 0, 0); // 2026-09-30 20:00 UTC

function state(over: Partial<PlaybackState> = {}): PlaybackState {
  return {
    isPlaying: true,
    positionSeconds: 100,
    positionAt: T0,
    durationSeconds: 1491, // 24:51
    ...over,
  };
}

describe("expectedPosition", () => {
  it("advances with wall-clock time while playing", () => {
    expect(expectedPosition(state(), T0 + 10_000)).toBe(110);
  });

  it("stands still while paused, however long ago the claim was", () => {
    expect(expectedPosition(state({ isPlaying: false }), T0 + 600_000)).toBe(100);
  });

  it("never runs past the end of the video", () => {
    expect(expectedPosition(state({ positionSeconds: 1480 }), T0 + 60_000)).toBe(1491);
  });

  it("still advances when the duration is not known yet", () => {
    expect(expectedPosition(state({ durationSeconds: null }), T0 + 30_000)).toBe(130);
  });

  it("does not run backwards if a client's clock is behind the claim", () => {
    expect(expectedPosition(state(), T0 - 5_000)).toBe(100);
  });
});

describe("shouldResync", () => {
  it("lets small drift ride — a seek is more jarring than the gap", () => {
    expect(shouldResync(100, 101)).toBe(false);
    expect(shouldResync(101, 100)).toBe(false);
  });

  it("corrects once we are more than the tolerance apart, either way", () => {
    expect(shouldResync(100, 104)).toBe(true);
    expect(shouldResync(104, 100)).toBe(true);
  });

  it("honours a custom tolerance", () => {
    expect(shouldResync(100, 100.4, 0.25)).toBe(true);
  });
});

describe("claimAt", () => {
  it("stamps the moment the claim was made", () => {
    expect(claimAt(42, true, 1491, T0)).toEqual({
      isPlaying: true,
      positionSeconds: 42,
      positionAt: T0,
      durationSeconds: 1491,
    });
  });

  it("clamps a claim that overshoots the end", () => {
    expect(claimAt(9999, false, 1491, T0).positionSeconds).toBe(1491);
  });

  it("never claims a negative position", () => {
    expect(claimAt(-3, false, null, T0).positionSeconds).toBe(0);
  });
});

describe("clampToDuration", () => {
  it("passes a position inside the video through", () => {
    expect(clampToDuration(50, 100)).toBe(50);
  });
  it("treats a zero or bogus duration as unknown", () => {
    expect(clampToDuration(5000, 0)).toBe(5000);
    expect(clampToDuration(5000, Number.NaN)).toBe(5000);
  });
});

describe("seekFromRatio", () => {
  it("maps a click on the bar to a position", () => {
    expect(seekFromRatio(0.5, 1000)).toBe(500);
  });
  it("clamps a sloppy tap outside the bar", () => {
    expect(seekFromRatio(-0.2, 1000)).toBe(0);
    expect(seekFromRatio(1.4, 1000)).toBe(1000);
  });
  it("cannot seek a video of unknown length", () => {
    expect(seekFromRatio(0.5, null)).toBe(0);
  });
});

describe("formatClock", () => {
  it("renders m:ss under an hour", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(763)).toBe("12:43");
    expect(formatClock(1491)).toBe("24:51");
  });
  it("renders h:mm:ss once past an hour", () => {
    expect(formatClock(3725)).toBe("1:02:05");
  });
  it("shrugs off nonsense", () => {
    expect(formatClock(-5)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });
});

describe("minutesTogether", () => {
  const start = "2026-09-30T20:00:00.000Z";

  it("rounds to the nearest minute", () => {
    expect(minutesTogether(start, "2026-09-30T20:24:20.000Z")).toBe(24);
    expect(minutesTogether(start, "2026-09-30T20:24:40.000Z")).toBe(25);
  });

  it("counts a short sit-down as one minute, never zero", () => {
    expect(minutesTogether(start, "2026-09-30T20:00:40.000Z")).toBe(1);
  });

  it("is zero when nothing ever started", () => {
    expect(minutesTogether(null, "2026-09-30T20:24:00.000Z")).toBe(0);
  });

  it("is zero rather than negative if the clocks disagree", () => {
    expect(minutesTogether(start, "2026-09-30T19:00:00.000Z")).toBe(0);
  });
});

describe("isControllable", () => {
  it("is true only for the sources the room can actually drive", () => {
    expect(isControllable("youtube")).toBe(true);
    expect(isControllable("file")).toBe(true);
    expect(isControllable("embed")).toBe(false);
  });
});
