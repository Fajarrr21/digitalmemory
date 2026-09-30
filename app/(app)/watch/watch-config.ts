/**
 * Watch Together — all the copy and the few tunable numbers in one place, so
 * the room's words can be softened without touching its logic.
 *
 * "You bring the video. We make it a moment together." 🍿
 */

export const WATCH_TAGLINE = "Bring something to watch. We'll watch it together.";

/** The three lines on the Home / landing card. */
export const WATCH_INVITATION = [
  "Something to watch?",
  "Something to laugh at?",
  "Something to get scared by?",
] as const;

export type SourceChoice = {
  id: "youtube" | "site" | "link";
  emoji: string;
  label: string;
  hint: string;
  /** What the input asks for. */
  placeholder: string;
};

/** YouTube is only one of the doors. */
export const SOURCE_CHOICES: SourceChoice[] = [
  {
    id: "youtube",
    emoji: "🔴",
    label: "YouTube",
    hint: "Watch a YouTube video",
    placeholder: "https://youtu.be/…",
  },
  {
    id: "site",
    emoji: "🌐",
    label: "Other Website",
    hint: "Bring a video from another supported site",
    placeholder: "https://example.com/watch/episode-12",
  },
  {
    id: "link",
    emoji: "🔗",
    label: "Video Link",
    hint: "Paste a video URL",
    placeholder: "https://…/episode-12.mp4",
  },
];

/** Quick reactions — they float over the video and vanish. */
export const REACTIONS = ["❤️", "😂", "😭", "😮", "🔥", "👀"] as const;
export type Reaction = (typeof REACTIONS)[number];

/** The four emoji that get their own buttons in the mobile control row. */
export const QUICK_REACTIONS: Reaction[] = ["❤️", "😂", "😭", "🔥"];

/** Longest a chat line may be (the column matches). */
export const CHAT_MAX = 1000;

/** "Snack break?" appears once a pause has lasted this long. */
export const SNACK_BREAK_AFTER_MS = 45_000;

/** 3 → 2 → 1 → PLAY. */
export const COUNTDOWN_FROM = 3;
export const COUNTDOWN_STEP_MS = 900;

/** How long a floating reaction lives on screen. */
export const REACTION_LIFETIME_MS = 2600;

/** Nobody is "away" the instant their tab blurs — give it a moment. */
export const AWAY_AFTER_MS = 20_000;

/** Voice: public STUN only. No relay server, so a hostile NAT can defeat it —
 *  the room says so rather than pretending the call connected. */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

/** RMS above this counts as "speaking" for the glowing ring. */
export const SPEAKING_THRESHOLD = 0.035;

/** What the room says about a source it cannot drive. */
export const EMBED_CAVEAT =
  "Situs ini main di dalam room, tapi kita nggak bisa mengendalikan playernya dari sini — jadi kita hitung mundur bareng, lalu tekan play masing-masing. ♡";

export const SOURCE_NOTES: Record<string, string> = {
  youtube: "Playback-nya benar-benar sinkron: pause di sini, pause di sana.",
  file: "Playback-nya benar-benar sinkron: pause di sini, pause di sana.",
  embed: EMBED_CAVEAT,
};

/** The wrap screen's little prompts for the note box. */
export const WRAP_NOTE_PLACEHOLDERS = [
  "Kita malah lebih banyak ketawa daripada nonton 😭",
  "Kamu ketiduran di menit 12 ♡",
  "Ini harus diulang kapan-kapan.",
];

export function sourceNote(kind: string): string {
  return SOURCE_NOTES[kind] ?? "";
}
