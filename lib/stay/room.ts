import type { StayLamp, StayScene } from "@/lib/supabase/database.types";

/**
 * stay, my love. — the room as a small state machine. Pure (no IO, no React),
 * so every transition is unit tested (room.test.ts) and the room can never
 * end up in a state the drawing doesn't know how to show.
 *
 * The rule the whole thing follows: an interaction always moves FORWARD from
 * where you are. Tapping the bed while you're already lying under the blanket
 * doesn't stand you back up and replay everything — it just says something
 * soft. Nothing here is a health state; it's furniture.
 */

export type Pose = "idle" | "sitting" | "lying";
export type BearSpot = "home" | "hugged" | "beside";
export type Focus = "bed" | "blanket" | "bear" | "lamp" | "window" | "character" | null;

export type RoomState = {
  pose: Pose;
  /** Blanket pulled up. Only ever true while lying. */
  tucked: boolean;
  bear: BearSpot;
  lamp: StayLamp;
  scene: StayScene;
  /** What was touched last — decides which little choices are offered. */
  focus: Focus;
  /** The line the room just said (a key into the copy), if any. */
  line: LineKey | null;
  /** Bumps on every interaction, so the same line can re-appear and repeated
   *  taps can rotate through gentle variations. */
  beat: number;
};

export type LineKey =
  | "sit"
  | "lie"
  | "already_lying"
  | "tucked"
  | "tucked_again"
  | "untucked"
  | "got_up"
  | "bear_hug"
  | "bear_hug_again"
  | "bear_beside"
  | "bear_home"
  | "lamp_warm"
  | "lamp_dim"
  | "lamp_window"
  | "scene_rain"
  | "scene_night"
  | "scene_morning"
  | "hello"
  | "rest";

export type RoomAction =
  | { type: "tap_bed" }
  | { type: "tap_blanket" }
  | { type: "untuck" }
  | { type: "lie_down" }
  | { type: "get_up" }
  | { type: "tap_bear" }
  | { type: "bear_beside" }
  | { type: "bear_home" }
  | { type: "tap_lamp" }
  | { type: "tap_window" }
  | { type: "tap_character" }
  /** "you can rest here": lying, tucked in, the bear beside you, lamp warm. */
  | { type: "settle" }
  | { type: "hush" };

export const LAMP_ORDER: readonly StayLamp[] = ["warm", "dim", "window"];
export const SCENE_ORDER: readonly StayScene[] = ["rain", "night", "morning"];

export function initialRoom(prefs: { lamp: StayLamp; scene: StayScene }): RoomState {
  return {
    pose: "idle",
    tucked: false,
    bear: "home",
    lamp: prefs.lamp,
    scene: prefs.scene,
    focus: null,
    line: null,
    beat: 0,
  };
}

function next<T>(order: readonly T[], current: T): T {
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}

export function roomReducer(s: RoomState, a: RoomAction): RoomState {
  const say = (patch: Partial<RoomState>, line: LineKey | null, focus: Focus): RoomState => ({
    ...s,
    ...patch,
    line,
    focus,
    beat: s.beat + 1,
  });

  switch (a.type) {
    case "tap_bed":
      if (s.pose === "idle") return say({ pose: "sitting" }, "sit", "bed");
      if (s.pose === "sitting") return say({ pose: "lying" }, "lie", "bed");
      return say({}, "already_lying", "bed");

    case "lie_down":
      return s.pose === "lying" ? say({}, "already_lying", "bed") : say({ pose: "lying" }, "lie", "bed");

    case "tap_blanket":
      // Pulling the blanket up always settles you in — never the other way.
      if (!s.tucked) return say({ pose: "lying", tucked: true }, "tucked", "blanket");
      return say({}, "tucked_again", "blanket");

    case "untuck":
      return s.tucked ? say({ tucked: false }, "untucked", "blanket") : s;

    case "get_up":
      if (s.pose === "idle") return s;
      // The bear comes along in your arms rather than being left on the bed.
      return say(
        { pose: "idle", tucked: false, bear: s.bear === "beside" ? "hugged" : s.bear },
        "got_up",
        "bed",
      );

    case "tap_bear":
      if (s.bear === "hugged") {
        // Squeezed again: it stays in your arms (the drawing re-plays the squish).
        return say({}, "bear_hug_again", "bear");
      }
      return say({ bear: "hugged" }, "bear_hug", "bear");

    case "bear_beside":
      // Only somewhere to put it once you're on the bed.
      if (s.pose === "idle") return say({ pose: "sitting", bear: "beside" }, "bear_beside", "bear");
      return say({ bear: "beside" }, "bear_beside", "bear");

    case "bear_home":
      return s.bear === "home" ? s : say({ bear: "home" }, "bear_home", "bear");

    case "tap_lamp": {
      const lamp = next(LAMP_ORDER, s.lamp);
      return say({ lamp }, `lamp_${lamp}` as LineKey, "lamp");
    }

    case "tap_window": {
      const scene = next(SCENE_ORDER, s.scene);
      return say({ scene }, `scene_${scene}` as LineKey, "window");
    }

    case "tap_character":
      return say({}, "hello", "character");

    case "settle":
      return say({ pose: "lying", tucked: true, bear: "beside", lamp: "warm" }, "rest", null);

    case "hush":
      return { ...s, line: null, focus: null };
  }
}

/** The small choices offered under the room for whatever was touched last. */
export type Chip = { action: RoomAction; key: ChipKey };
export type ChipKey =
  | "lie_down"
  | "pull_blanket"
  | "fold_blanket"
  | "get_up"
  | "bear_beside"
  | "bear_hug"
  | "bear_home";

export function chipsFor(s: RoomState): Chip[] {
  switch (s.focus) {
    case "bed":
    case "blanket": {
      const out: Chip[] = [];
      if (s.pose === "sitting") out.push({ action: { type: "lie_down" }, key: "lie_down" });
      if (!s.tucked) out.push({ action: { type: "tap_blanket" }, key: "pull_blanket" });
      if (s.tucked) out.push({ action: { type: "untuck" }, key: "fold_blanket" });
      if (s.pose !== "idle") out.push({ action: { type: "get_up" }, key: "get_up" });
      return out;
    }
    case "bear": {
      const out: Chip[] = [];
      if (s.bear !== "beside") out.push({ action: { type: "bear_beside" }, key: "bear_beside" });
      if (s.bear !== "hugged") out.push({ action: { type: "tap_bear" }, key: "bear_hug" });
      if (s.bear !== "home") out.push({ action: { type: "bear_home" }, key: "bear_home" });
      return out;
    }
    default:
      return [];
  }
}
