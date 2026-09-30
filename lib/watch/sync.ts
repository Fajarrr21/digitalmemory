/**
 * The shared playback clock for a Watch Room — pure, so it can be unit-tested
 * and reasoned about without a browser or a database.
 *
 * A room never stores "where we are" as a number that has to be constantly
 * refreshed. It stores a *claim*: "we were at `positionSeconds` as of
 * `positionAt`, and we were (or weren't) playing." Every client derives the
 * present from that pair, which is what makes a late joiner, a reload, or a
 * reconnect land in the right second without anyone re-broadcasting.
 */

export type PlaybackState = {
  isPlaying: boolean;
  /** Position claimed at `positionAt`, in seconds. */
  positionSeconds: number;
  /** Epoch milliseconds the claim was made. */
  positionAt: number;
  durationSeconds: number | null;
};

/**
 * How far apart two players may drift before we correct one. Below ~1s a seek
 * is more jarring than the gap it fixes (and YouTube's own seek granularity is
 * coarse), so we let small drift ride.
 */
export const DRIFT_TOLERANCE_SECONDS = 1.5;

/** How often the room re-states the truth while playing. */
export const CLOCK_TICK_MS = 5000;
/** Slow safety net in case a broadcast is missed entirely. */
export const ROOM_POLL_MS = 6000;

/** Where the shared clock says we should be, right now. */
export function expectedPosition(state: PlaybackState, now: number = Date.now()): number {
  const elapsed = state.isPlaying ? Math.max(0, (now - state.positionAt) / 1000) : 0;
  const raw = state.positionSeconds + elapsed;
  return clampToDuration(raw, state.durationSeconds);
}

/** Keep a position inside the video; a null duration means "not known yet". */
export function clampToDuration(seconds: number, duration: number | null): number {
  const floored = Math.max(0, seconds);
  if (duration === null || !Number.isFinite(duration) || duration <= 0) return floored;
  return Math.min(floored, duration);
}

/** True when this player has drifted far enough that it should jump. */
export function shouldResync(
  localSeconds: number,
  expectedSeconds: number,
  tolerance: number = DRIFT_TOLERANCE_SECONDS,
): boolean {
  return Math.abs(localSeconds - expectedSeconds) > tolerance;
}

/** A fresh claim to write/broadcast: "we are HERE, as of now." */
export function claimAt(
  seconds: number,
  isPlaying: boolean,
  duration: number | null,
  now: number = Date.now(),
): PlaybackState {
  return {
    isPlaying,
    positionSeconds: clampToDuration(seconds, duration),
    positionAt: now,
    durationSeconds: duration,
  };
}

/** Click-on-the-bar → a position. Ratio is clamped, so a sloppy tap is fine. */
export function seekFromRatio(ratio: number, duration: number | null): number {
  const r = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  if (duration === null || !Number.isFinite(duration) || duration <= 0) return 0;
  return r * duration;
}

/** 0 → "0:00", 763 → "12:43", 3725 → "1:02:05". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0
    ? `${h}:${mm}:${String(s).padStart(2, "0")}`
    : `${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * "You watched together for 24 minutes." Rounded to the nearest minute, but
 * never to zero when you actually sat down for something — a 40-second clip
 * still counts as a minute together.
 */
export function minutesTogether(
  startedAt: string | null,
  endedAt: string | number | null = Date.now(),
): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = typeof endedAt === "number" ? endedAt : endedAt ? new Date(endedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 60000));
}

/** Only youtube/file sources can actually be driven by the room. */
export function isControllable(kind: string): boolean {
  return kind === "youtube" || kind === "file";
}
