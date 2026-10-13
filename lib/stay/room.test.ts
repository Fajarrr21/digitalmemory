import { describe, expect, it } from "vitest";
import { chipsFor, initialRoom, roomReducer, type RoomAction, type RoomState } from "@/lib/stay/room";

const start = () => initialRoom({ lamp: "warm", scene: "rain" });
const run = (s: RoomState, ...actions: RoomAction["type"][]) =>
  actions.reduce((acc, type) => roomReducer(acc, { type } as RoomAction), s);

describe("the bed", () => {
  it("sit, then lie down", () => {
    const s1 = run(start(), "tap_bed");
    expect(s1.pose).toBe("sitting");
    expect(s1.line).toBe("sit");
    const s2 = run(s1, "tap_bed");
    expect(s2.pose).toBe("lying");
    expect(s2.line).toBe("lie");
  });
  it("tapping the bed while lying never restarts anything", () => {
    const lying = run(start(), "tap_bed", "tap_bed", "tap_blanket");
    const again = run(lying, "tap_bed");
    expect(again.pose).toBe("lying");
    expect(again.tucked).toBe(true);
    expect(again.line).toBe("already_lying");
  });
});

describe("the blanket", () => {
  it("pulling it up settles you in from anywhere", () => {
    const s = run(start(), "tap_blanket");
    expect(s).toMatchObject({ pose: "lying", tucked: true, line: "tucked" });
  });
  it("tapping it again keeps you tucked in", () => {
    const s = run(start(), "tap_blanket", "tap_blanket");
    expect(s).toMatchObject({ pose: "lying", tucked: true, line: "tucked_again" });
  });
  it("can be folded back without getting up", () => {
    const s = run(start(), "tap_blanket", "untuck");
    expect(s).toMatchObject({ pose: "lying", tucked: false });
  });
  it("folding an already-folded blanket is a no-op", () => {
    const s0 = start();
    expect(roomReducer(s0, { type: "untuck" })).toBe(s0);
  });
});

describe("getting up", () => {
  it("folds the blanket and takes the bear along", () => {
    const s = run(start(), "tap_blanket", "bear_beside", "get_up");
    expect(s).toMatchObject({ pose: "idle", tucked: false, bear: "hugged" });
  });
  it("is a no-op when already up", () => {
    const s0 = start();
    expect(roomReducer(s0, { type: "get_up" })).toBe(s0);
  });
});

describe("the teddy bear", () => {
  it("hug → beside → home, repeatably", () => {
    let s = run(start(), "tap_bear");
    expect(s.bear).toBe("hugged");
    s = run(s, "tap_bear");
    expect(s.bear).toBe("hugged");
    expect(s.line).toBe("bear_hug_again");
    s = run(s, "bear_beside");
    expect(s.bear).toBe("beside");
    expect(s.pose).toBe("sitting"); // somewhere to put it
    s = run(s, "bear_home", "tap_bear", "bear_home", "tap_bear");
    expect(s.bear).toBe("hugged");
  });
  it("putting it beside you doesn't move you if you're already lying", () => {
    const s = run(start(), "tap_blanket", "bear_beside");
    expect(s).toMatchObject({ pose: "lying", tucked: true, bear: "beside" });
  });
});

describe("lamp + window", () => {
  it("cycle through their states", () => {
    expect(run(start(), "tap_lamp").lamp).toBe("dim");
    expect(run(start(), "tap_lamp", "tap_lamp").lamp).toBe("window");
    expect(run(start(), "tap_lamp", "tap_lamp", "tap_lamp").lamp).toBe("warm");
    expect(run(start(), "tap_window").scene).toBe("night");
    expect(run(start(), "tap_window", "tap_window", "tap_window").scene).toBe("rain");
  });
});

describe("settle (you can rest here)", () => {
  it("puts everything in place from any state", () => {
    const s = run(start(), "tap_lamp", "tap_lamp", "tap_bear", "settle");
    expect(s).toMatchObject({ pose: "lying", tucked: true, bear: "beside", lamp: "warm" });
  });
});

describe("chips", () => {
  it("offer the next gentle steps for what was touched", () => {
    const sitting = run(start(), "tap_bed");
    expect(chipsFor(sitting).map((c) => c.key)).toEqual(["lie_down", "pull_blanket", "get_up"]);
    const tucked = run(start(), "tap_blanket");
    expect(chipsFor(tucked).map((c) => c.key)).toEqual(["fold_blanket", "get_up"]);
    const hugging = run(start(), "tap_bear");
    expect(chipsFor(hugging).map((c) => c.key)).toEqual(["bear_beside", "bear_home"]);
    expect(chipsFor(run(start(), "tap_lamp"))).toEqual([]);
  });
});

it("beat always moves forward so a repeated line re-appears", () => {
  const s = run(start(), "tap_character", "tap_character");
  expect(s.beat).toBe(2);
  expect(run(s, "hush").line).toBeNull();
});
