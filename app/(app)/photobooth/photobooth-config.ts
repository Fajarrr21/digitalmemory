/**
 * A Little Photo Booth — frame templates & prompts.
 *
 * Each frame is a real image template (public/photobooth/frames/{id}.webp)
 * whose photo windows were punched TRANSPARENT offline (scratchpad tooling,
 * from the curated frame-photobooth pack). Photos render BEHIND the template,
 * so window shapes (tilted polaroids, curved TV screens) clip themselves and
 * decorations that overlap a window stay on top — like a real booth overlay.
 *
 * `slots` are normalized bboxes (fractions of the template size), top→bottom,
 * already expanded ~3% so the photo overshoots the hole edges.
 */

export type BoothSlot = { x: number; y: number; w: number; h: number };

export type BoothTemplate = {
  id: string;
  name: string;
  /** Template pixel size (for aspect + export scale). */
  w: number;
  h: number;
  slots: BoothSlot[];
};

export function templateSrc(id: string): string {
  return `/photobooth/frames/${id}.webp`;
}
export function templateThumb(id: string): string {
  return `/photobooth/frames/${id}.thumb.webp`;
}

export const BOOTH_TEMPLATES: BoothTemplate[] = [
  { id: "red-lace", name: "Red Lace", w: 736, h: 1308, slots: [
    { x: 0.1537, y: 0.0599, w: 0.7158, h: 0.2342 },
    { x: 0.1118, y: 0.3602, w: 0.7532, h: 0.2391 },
    { x: 0.1352, y: 0.6723, w: 0.7432, h: 0.2318 },
  ] },
  { id: "retro-tv", name: "Retro TV", w: 736, h: 1308, slots: [
    { x: 0.0688, y: 0.0862, w: 0.5458, h: 0.2488 },
    { x: 0.4265, y: 0.3838, w: 0.5329, h: 0.2423 },
    { x: 0.0734, y: 0.6886, w: 0.5761, h: 0.278 },
  ] },
  { id: "denim-sea", name: "Denim Sea", w: 736, h: 1308, slots: [
    { x: 0.4998, y: 0.0237, w: 0.4378, h: 0.2423 },
    { x: 0.0582, y: 0.3525, w: 0.4407, h: 0.2415 },
    { x: 0.5061, y: 0.6863, w: 0.458, h: 0.252 },
  ] },
  { id: "coastal", name: "Coastal", w: 599, h: 1064, slots: [
    { x: 0.3985, y: 0.1082, w: 0.5468, h: 0.3596 },
    { x: 0.062, y: 0.4621, w: 0.5804, h: 0.3756 },
  ] },
  { id: "starry-night", name: "Starry Night", w: 736, h: 1308, slots: [
    { x: 0.5263, y: 0.0356, w: 0.4162, h: 0.2277 },
    { x: 0.0129, y: 0.2383, w: 0.4551, h: 0.2512 },
    { x: 0.1348, y: 0.6262, w: 0.471, h: 0.2674 },
  ] },
  { id: "babygirl", name: "Babygirl", w: 675, h: 1200, slots: [
    { x: 0.4076, y: 0.3101, w: 0.358, h: 0.2023 },
    { x: 0.4653, y: 0.4918, w: 0.3628, h: 0.2032 },
    { x: 0.5245, y: 0.6734, w: 0.3643, h: 0.2041 },
  ] },
  { id: "snoopy-market", name: "Snoopy Market", w: 736, h: 1308, slots: [
    { x: 0.5448, y: 0.2504, w: 0.4335, h: 0.2828 },
    { x: 0.1106, y: 0.3392, w: 0.3644, h: 0.1426 },
    { x: 0.441, y: 0.5755, w: 0.4033, h: 0.1678 },
  ] },
  { id: "cherry-denim", name: "Cherry Denim", w: 736, h: 1308, slots: [
    { x: 0.3803, y: 0.0871, w: 0.4378, h: 0.2464 },
    { x: 0.3815, y: 0.3447, w: 0.4407, h: 0.248 },
    { x: 0.3829, y: 0.6039, w: 0.4421, h: 0.2464 },
  ] },
  { id: "loopy", name: "Loopy", w: 736, h: 1308, slots: [
    { x: 0.1277, y: 0.046, w: 0.386, h: 0.2131 },
    { x: 0.0742, y: 0.394, w: 0.4033, h: 0.205 },
    { x: 0.3278, y: 0.6047, w: 0.517, h: 0.325 },
  ] },
  { id: "toy-story", name: "Toy Story", w: 736, h: 1308, slots: [
    { x: 0.4236, y: 0.2613, w: 0.3471, h: 0.1945 },
    { x: 0.4494, y: 0.454, w: 0.3485, h: 0.1937 },
    { x: 0.4752, y: 0.6451, w: 0.3485, h: 0.1953 },
  ] },
  { id: "about-you", name: "About You", w: 675, h: 1200, slots: [
    { x: 0.2502, y: 0.3733, w: 0.3737, h: 0.1466 },
    { x: 0.2235, y: 0.5109, w: 0.3737, h: 0.1466 },
    { x: 0.1983, y: 0.6483, w: 0.3753, h: 0.1466 },
  ] },
  { id: "ticket-anywhere", name: "Ticket To Anywhere", w: 675, h: 1200, slots: [
    { x: 0.3158, y: 0.2922, w: 0.358, h: 0.129 },
    { x: 0.3158, y: 0.4322, w: 0.358, h: 0.129 },
    { x: 0.3173, y: 0.5722, w: 0.358, h: 0.1298 },
  ] },
  { id: "street", name: "Street", w: 736, h: 1308, slots: [
    { x: 0.1974, y: 0.1138, w: 0.6121, h: 0.2747 },
    { x: 0.1904, y: 0.5491, w: 0.6179, h: 0.2642 },
  ] },
  { id: "cowboy", name: "Cowboy", w: 736, h: 1308, slots: [
    { x: 0.2995, y: 0.3014, w: 0.5545, h: 0.2083 },
    { x: 0.305, y: 0.5048, w: 0.5545, h: 0.2083 },
    { x: 0.3064, y: 0.7082, w: 0.553, h: 0.2083 },
  ] },
  { id: "ocean-denim", name: "Ocean Denim", w: 736, h: 1308, slots: [
    { x: 0.4822, y: 0.1385, w: 0.4378, h: 0.2926 },
    { x: 0.0981, y: 0.4486, w: 0.4234, h: 0.3039 },
  ] },
  { id: "memories-box", name: "Memories Box", w: 736, h: 1308, slots: [
    { x: 0.0005, y: 0.2581, w: 0.5098, h: 0.201 },
    { x: 0.5224, y: 0.3903, w: 0.4076, h: 0.231 },
    { x: 0, y: 0.4926, w: 0.5113, h: 0.2901 },
    { x: 0.3588, y: 0.7234, w: 0.6222, h: 0.2358 },
  ] },
  { id: "travel", name: "Travel", w: 736, h: 1308, slots: [
    { x: 0.0005, y: 0.2581, w: 0.5098, h: 0.201 },
    { x: 0.0261, y: 0.4711, w: 0.5185, h: 0.2901 },
    { x: 0.3588, y: 0.7234, w: 0.6207, h: 0.2358 },
  ] },
  { id: "spidey-strip", name: "Spidey Strip", w: 736, h: 1308, slots: [
    { x: 0.2858, y: 0.2182, w: 0.5602, h: 0.231 },
    { x: 0.2274, y: 0.4155, w: 0.5602, h: 0.231 },
    { x: 0.1689, y: 0.6135, w: 0.5602, h: 0.2302 },
  ] },
  { id: "amazing-spidey", name: "Amazing Spider-Man", w: 736, h: 1308, slots: [
    { x: 0.0109, y: 0.1239, w: 0.5761, h: 0.2399 },
    { x: 0.4504, y: 0.4034, w: 0.5516, h: 0.2245 },
    { x: 0.0096, y: 0.6901, w: 0.6697, h: 0.2512 },
  ] },
  { id: "spiderverse", name: "Spider-Verse", w: 736, h: 1308, slots: [
    { x: 0.0479, y: 0.0291, w: 0.4205, h: 0.2431 },
    { x: 0.0546, y: 0.3585, w: 0.422, h: 0.2439 },
    { x: 0.0587, y: 0.6858, w: 0.4234, h: 0.2439 },
  ] },
  { id: "gwen", name: "Gwen", w: 736, h: 1308, slots: [
    { x: 0.4305, y: 0.0051, w: 0.5833, h: 0.3614 },
    { x: 0.272, y: 0.3456, w: 0.4724, h: 0.2699 },
    { x: 0, y: 0.6232, w: 0.5818, h: 0.3752 },
  ] },
  { id: "maroon-cherry", name: "Maroon Cherry", w: 736, h: 1308, slots: [
    { x: 0.5491, y: 0.0512, w: 0.4249, h: 0.2447 },
    { x: 0.3207, y: 0.3523, w: 0.4306, h: 0.248 },
    { x: 0.03, y: 0.6398, w: 0.4277, h: 0.2464 },
  ] },
  { id: "zootopia", name: "Zootopia", w: 736, h: 1308, slots: [
    { x: 0.0513, y: 0.0339, w: 0.3485, h: 0.235 },
    { x: 0.3143, y: 0.3624, w: 0.7028, h: 0.2439 },
    { x: 0.0729, y: 0.7397, w: 0.543, h: 0.2545 },
  ] },
  { id: "wilde-hopps", name: "Wilde & Hopps", w: 675, h: 1200, slots: [
    { x: 0.0583, y: 0.05, w: 0.3486, h: 0.235 },
    { x: 0.5226, y: 0.3193, w: 0.4303, h: 0.2897 },
    { x: 0.1635, y: 0.7108, w: 0.3471, h: 0.235 },
  ] },
  { id: "snoopy-denim", name: "Snoopy Denim", w: 736, h: 1308, slots: [
    { x: 0.5213, y: 0.1243, w: 0.3024, h: 0.1742 },
    { x: 0.5744, y: 0.3461, w: 0.301, h: 0.1702 },
    { x: 0.6423, y: 0.5555, w: 0.301, h: 0.1742 },
    { x: 0.0031, y: 0.5634, w: 0.4177, h: 0.1896 },
  ] },
  { id: "chapter-2026", name: "Chapter 2026", w: 675, h: 1200, slots: [
    { x: 0.2507, y: 0.2523, w: 0.3565, h: 0.1546 },
    { x: 0.2507, y: 0.4015, w: 0.3549, h: 0.1546 },
    { x: 0.251, y: 0.5515, w: 0.3455, h: 0.1528 },
  ] },
  { id: "jelly-gummy", name: "Jelly Gummy", w: 736, h: 1472, slots: [
    { x: 0.0715, y: 0.0414, w: 0.8324, h: 0.265 },
    { x: 0.0714, y: 0.3758, w: 0.8382, h: 0.2614 },
    { x: 0.07, y: 0.7073, w: 0.8396, h: 0.2621 },
  ] },
  { id: "romeo", name: "Romeo", w: 736, h: 1308, slots: [
    { x: 0.4253, y: 0.4027, w: 0.5257, h: 0.3055 },
  ] },
  { id: "strawberry-knit", name: "Strawberry Knit", w: 736, h: 1308, slots: [
    { x: 0.4834, y: 0.3193, w: 0.4911, h: 0.2796 },
  ] },
];

export function templateById(id: string | null | undefined): BoothTemplate {
  return BOOTH_TEMPLATES.find((t) => t.id === id) ?? BOOTH_TEMPLATES[0];
}

/** Both of Us needs at least one slot for each person. */
export const DUO_TEMPLATES: BoothTemplate[] = BOOTH_TEMPLATES.filter(
  (t) => t.slots.length >= 2,
);

/** In a duo session the slots alternate: creator ⇄ partner, top to bottom. */
export function slotOwnerIsCreator(slotIndex: number): boolean {
  return slotIndex % 2 === 0;
}
export function mySlots(template: BoothTemplate, isCreator: boolean): number[] {
  return template.slots
    .map((_, i) => i)
    .filter((i) => slotOwnerIsCreator(i) === isCreator);
}

// ---- Pose prompts -------------------------------------------------------------

/** Optional pose prompts — skipping is always free. */
export const SOLO_PROMPTS: string[] = [
  "😎 Show me your “I survived today” face.",
  "🫣 Hide half of your face.",
  "🐱 Give me your cutest expression.",
  "😐 Now… your most serious face.",
  "🌞 The face you make when a good song comes on.",
  "🥱 Your honest 11pm face.",
  "✌️ Classic peace sign. No shame.",
];

/** Duo prompts by shot order — the same line shows on both phones. */
export const DUO_SHOT_PROMPTS: string[] = [
  "Smile. ♡",
  "Now be silly.",
  "Look at each other (yes, even from afar).",
  "One last one. Make it count.",
];

export function randomSoloPrompt(): string {
  return SOLO_PROMPTS[Math.floor(Math.random() * SOLO_PROMPTS.length)];
}

// ---- Capture & session constants ----------------------------------------------

/** Longest side of a captured photo, px. */
export const CAPTURE_MAX = 1080;
/** Countdown before the shutter. */
export const COUNTDOWN_FROM = 3;
/** Duo session poll cadence (ms). */
export const BOOTH_POLL_MS = 2500;
/** Default album titles for keeping a finished strip. */
export const SOLO_ALBUM_TITLE = "My Photobooth";
export const DUO_ALBUM_TITLE = "Our Photobooth";
