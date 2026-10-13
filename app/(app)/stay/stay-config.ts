import type { StayGiftKind, StayLamp, StayObjectKind, StayScene } from "@/lib/supabase/database.types";
import type { ChipKey, LineKey } from "@/lib/stay/room";

/**
 * stay, my love. — the words. The intimate lines are English (soft, lower-
 * case, like a note); functional bits follow the app and stay Indonesian.
 *
 * Tone rules: you're allowed to rest, be quiet, and not perform being okay.
 * No "you are strong", no medical anything, nothing that asks for a reply.
 * The truly personal sentences are NOT here — they're the notes, voices and
 * comfort messages you leave each other through /stay/leave.
 */

export const STAY_TITLE = "stay, my love. ♡";

export const OPENING_FIRST = ["hey, love.", "you don't have to do anything right now.", "just stay a little."];
export const OPENING_RETURN = ["welcome back, love.", "your room's still warm."];
export const COME_IN = "come in ♡";

/** What the room says after each touch. Some lines rotate on repeat taps. */
export const LINES: Record<LineKey, string[]> = {
  sit: ["there you go. get comfortable, okay?"],
  lie: ["lie down for a bit. you don't need to be productive right now.", "there. no rush to get up."],
  already_lying: ["you're already right where you should be.", "stay. the bed isn't going anywhere."],
  tucked: ["tucked in. nice and warm.", "there. all the way up to your chin."],
  tucked_again: [
    "if i could, i'd make sure you were comfortable right now.",
    "still warm? good.",
    "i'd fix the corner of the blanket for you, if i were there.",
  ],
  untucked: ["a little cooler. that's okay too."],
  got_up: ["up already? take it slow."],
  bear_hug: ["hold on to him for a while.", "he's soft. squeeze as hard as you need."],
  bear_hug_again: ["one more squeeze.", "he doesn't mind. not even a little."],
  bear_beside: ["he'll keep you company right there."],
  bear_home: ["back to his little seat. he'll wait."],
  lamp_warm: ["warm light. the cozy kind."],
  lamp_dim: ["a little dimmer. sleepy light."],
  lamp_window: ["lamp off. just the window now."],
  scene_rain: ["rain on the window. stay in, it's nice in here."],
  scene_night: ["a clear night. quiet out there, quiet in here."],
  scene_morning: ["soft morning light. no hurry, though."],
  hello: ["hi, you.", "i'm glad you came in.", "you don't have to say anything."],
  rest: ["…"],
};

export function lineFor(key: LineKey, beat: number): string {
  const options = LINES[key];
  return options[beat % options.length];
}

export const CHIP_LABEL: Record<ChipKey, string> = {
  lie_down: "berbaring",
  pull_blanket: "tarik selimut",
  fold_blanket: "lipat selimut",
  get_up: "bangun",
  bear_beside: "taruh di sampingmu",
  bear_hug: "peluk lagi",
  bear_home: "kembalikan ke kursinya",
};

export const LAMP_LABEL: Record<StayLamp, string> = {
  warm: "hangat",
  dim: "redup",
  window: "cahaya jendela",
};

export const SCENE_LABEL: Record<StayScene, string> = {
  rain: "malam berhujan",
  night: "langit malam",
  morning: "pagi yang lembut",
};

/** "you can rest here." — the default beats. A comfort message, if one was left, is the last line. */
export const REST_TITLE = "you can rest here.";
export const REST_LINES = [
  "you don't have to tell me what's wrong.",
  "you don't have to smile for me.",
  "you can be quiet, too.",
  "i just want you to know that you're loved.",
];
export const REST_CHOICES = {
  stay: "stay a little longer",
  note: "leave a little note",
  go: "i'm ready to go",
} as const;

export const GIFT_KIND: Record<StayGiftKind, { name: string; line: string; verb: string }> = {
  note: { name: "a handwritten note", line: "Surat kecil yang terlipat di meja samping kasurnya.", verb: "a note" },
  voice: { name: "a voice", line: "Suaramu, untuk diputar kapan pun dia mau.", verb: "a voice" },
  object: { name: "a little something", line: "Benda kecil yang tinggal di kamarnya.", verb: "a little something" },
  comfort: {
    name: "for when you rest",
    line: "Kalimat terakhir yang dibisikkan kamar saat dia memilih “you can rest here”.",
    verb: "words for resting",
  },
};

export const OBJECTS: { key: StayObjectKind; name: string }[] = [
  { key: "flower", name: "a tiny pink flower" },
  { key: "heart", name: "a glowing heart" },
  { key: "star", name: "a little plush star" },
  { key: "crane", name: "a paper crane" },
  { key: "moon", name: "a little moon charm" },
];

export function objectName(key: StayObjectKind | null | undefined) {
  return OBJECTS.find((o) => o.key === key)?.name ?? "a little something";
}

export const LIGHT_LINE = {
  together: (them: string) => `${them} is here too. ♡`,
  warm: () => "something's waiting for you on the table.",
  quiet: () => "it's quiet. the light stays on anyway.",
} as const;
