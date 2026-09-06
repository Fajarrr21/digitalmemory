/**
 * Plain module (NOT "use server") so this array can be imported by both the
 * server action and the client form. A "use server" file may only export
 * async functions — exporting a value from one breaks on the client.
 */
export const LETTER_CATEGORIES = [
  "good_morning",
  "good_night",
  "romantic",
  "comfort",
  "appreciation",
  "missing_you",
  "celebration",
  "proud_of_you",
  "sad_day",
  "motivation",
  "random_love",
] as const;

export type LetterCategory = (typeof LETTER_CATEGORIES)[number];
