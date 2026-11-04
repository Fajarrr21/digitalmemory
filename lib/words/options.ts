/**
 * little words. — the shared vocabulary. Every choice the UI offers and every
 * instruction the AI receives comes from these lists, so a label on screen
 * and the craft note behind it can never drift apart. Pure data; safe on
 * both client and server.
 *
 * `label` is what the person sees (English, like the rest of the feature's
 * names), `hint` is the short Indonesian explanation under it, and `craft`
 * is the note the AI is given — written as guidance for a writer, not as
 * keywords to sprinkle in.
 */

import type { OpenWhen, WordsLanguage, WorkType } from "@/lib/supabase/database.types";

export type Option<K extends string = string> = { key: K; label: string; hint?: string; craft?: string };

/* ---------------------------------------------------------------- forms -- */

export const WORK_TYPES: (Option<WorkType> & { emoji: string; styles: Option[] })[] = [
  {
    key: "poetry",
    label: "Poetry",
    emoji: "✒️",
    hint: "Puisi",
    craft:
      "A poem: meaning carried by line breaks, stanza shape, sound and image. Each line break must earn its place " +
      "(a pause, a turn, an emphasis). Never a paragraph chopped into lines. Compression over explanation.",
    styles: [
      { key: "free", label: "Puisi bebas", craft: "free verse; no fixed rhyme or metre, rhythm comes from syntax and breath" },
      { key: "romantic", label: "Puisi romantis", craft: "romantic, but through concrete detail rather than declarations" },
      { key: "reflective", label: "Puisi reflektif", craft: "reflective; the speaker turns a thought over and arrives somewhere new" },
      { key: "melancholic", label: "Puisi melankolis", craft: "melancholic; restraint, what is missing is felt more than named" },
      { key: "metaphoric", label: "Puisi metafora", craft: "built around one sustained, fresh central metaphor developed across stanzas" },
    ],
  },
  {
    key: "prose",
    label: "Prose",
    emoji: "📜",
    hint: "Prosa",
    craft:
      "Prose: full sentences in paragraphs with a continuous line of thought. Each sentence must lead into the next; " +
      "it is not a list of pretty romantic sentences. Rhythm comes from varied sentence length.",
    styles: [
      { key: "lyrical", label: "Prosa liris", craft: "lyrical prose; musical sentences, imagery-led, close to a prose poem" },
      { key: "romantic", label: "Prosa romantis", craft: "romantic prose grounded in specific moments" },
      { key: "reflective", label: "Prosa reflektif", craft: "reflective prose; a mind thinking on the page" },
      { key: "narrative", label: "Prosa naratif", craft: "narrative prose; a small scene with movement in time" },
      { key: "philosophical", label: "Prosa filosofis", craft: "philosophical prose; an idea examined, questioned, and deepened" },
    ],
  },
  {
    key: "letter",
    label: "Love Letter",
    emoji: "💌",
    hint: "Surat",
    craft:
      "A letter: addressed to one person, with the intimacy of direct address, an opening, a body that moves, and a " +
      "closing that is not a slogan. It should sound like a real person wrote it to a real person.",
    styles: [
      { key: "love", label: "Surat cinta", craft: "a love letter" },
      { key: "longing", label: "Surat kerinduan", craft: "a letter of longing across distance or time" },
      { key: "gratitude", label: "Surat penghargaan", craft: "a letter of appreciation for who they are and what they do" },
      { key: "future", label: "Surat untuk masa depan", craft: "a letter written to be read in the future" },
      { key: "unspoken", label: "Perasaan terpendam", craft: "a letter carrying a feeling held back for a long time" },
    ],
  },
  {
    key: "quote",
    label: "Short Quote",
    emoji: "❝",
    hint: "Kutipan",
    craft:
      "A short literary quote: one to four sentences that stand alone and resonate on rereading. Precision over " +
      "ornament; one idea, sharply turned.",
    styles: [
      { key: "romantic", label: "Kutipan romantis", craft: "romantic" },
      { key: "reflective", label: "Kalimat reflektif", craft: "reflective" },
      { key: "philosophical", label: "Kalimat filosofis", craft: "philosophical" },
      { key: "implicit", label: "Bermakna tersirat", craft: "the meaning sits beneath the surface; never stated" },
      { key: "fragment", label: "Potongan prosa", craft: "a short fragment of prose, as if torn from a longer piece" },
    ],
  },
];

export function workTypeOf(key: string | null | undefined) {
  return WORK_TYPES.find((w) => w.key === key) ?? WORK_TYPES[0];
}
export function styleOf(type: string | null | undefined, style: string | null | undefined) {
  return workTypeOf(type).styles.find((s) => s.key === style) ?? null;
}

/* --------------------------------------------------------------- themes -- */

export const THEMES: Option[] = [
  { key: "love", label: "Love and Affection" },
  { key: "longing", label: "Longing and Distance" },
  { key: "admiration", label: "Admiration" },
  { key: "waiting", label: "Waiting and Uncertainty" },
  { key: "memories", label: "Memories and Nostalgia" },
  { key: "acceptance", label: "Acceptance and Letting Go" },
  { key: "hope", label: "Hope and Future" },
  { key: "loneliness", label: "Loneliness" },
  { key: "gratitude", label: "Gratitude" },
  { key: "self", label: "Self-Reflection" },
  { key: "existence", label: "Human Existence" },
  { key: "time", label: "Life and Time" },
  { key: "unspoken", label: "Unspoken Feelings" },
];

/* ---------------------------------------------------------------- moods -- */

export const MOODS: Option[] = [
  { key: "romantic", label: "Romantic", craft: "warm, attentive, affectionate without gushing" },
  { key: "melancholic", label: "Melancholic", craft: "a quiet ache; sorrow held, not performed" },
  { key: "nostalgic", label: "Nostalgic", craft: "looking back; the sweetness and the loss of what can't repeat" },
  { key: "philosophical", label: "Philosophical", craft: "questioning, thoughtful, unhurried" },
  { key: "intimate", label: "Intimate", craft: "close, low-voiced, as if spoken near someone's ear" },
  { key: "tender", label: "Tender", craft: "gentle, careful, soft-handed" },
  { key: "dramatic", label: "Dramatic", craft: "heightened stakes and contrast, but never melodrama" },
  { key: "contemplative", label: "Contemplative", craft: "still, observant, slow" },
  { key: "hopeful", label: "Hopeful", craft: "light reaching forward, earned rather than announced" },
  { key: "bittersweet", label: "Bittersweet", craft: "joy and grief in the same breath" },
];

/* --------------------------------------------------------------- genres -- */

export const GENRES: Option[] = [
  {
    key: "romanticism",
    label: "Romanticism",
    hint: "cinta, kekaguman, keintiman",
    craft: "Build the idea around devotion and the beauty of feeling; the beloved is seen with wonder, the world heightened by them.",
  },
  {
    key: "melancholia",
    label: "Melancholia",
    hint: "kehilangan, rindu, belum selesai",
    craft: "Build the idea around absence and the unfinished; let the piece end without full resolution.",
  },
  {
    key: "nostalgia",
    label: "Nostalgia",
    hint: "kenangan, waktu, tak terulang",
    craft: "Build the idea around a remembered moment and its distance from now; time is a character.",
  },
  {
    key: "existentialism",
    label: "Existentialism",
    hint: "keberadaan, identitas, makna",
    craft: "Build the idea around being, choice and meaning-making; love as one of the ways a person decides who they are.",
  },
  {
    key: "contemplative",
    label: "Contemplative",
    hint: "refleksi pengalaman",
    craft: "Build the idea from close observation of an ordinary experience, then let reflection open out from it.",
  },
  {
    key: "philosophical",
    label: "Philosophical",
    hint: "pertanyaan, pemaknaan",
    craft: "Build the idea as an inquiry: pose a real question and move through it, rather than asserting answers.",
  },
  {
    key: "affection",
    label: "Affection",
    hint: "kasih sayang, perhatian",
    craft: "Build the idea from care in small acts: attention, noticing, keeping someone in mind.",
  },
  {
    key: "longing",
    label: "Longing",
    hint: "jarak, penantian, ingin bertemu",
    craft: "Build the idea around distance and waiting; the tension between here and there.",
  },
  {
    key: "acceptance",
    label: "Acceptance",
    hint: "keikhlasan, berdamai",
    craft: "Build the idea toward making peace; movement from resistance to release.",
  },
];

/* ---------------------------------------------------------------- depth -- */

export const DEPTHS: (Option & { level: number })[] = [
  {
    level: 1,
    key: "1",
    label: "Simple Poetic",
    hint: "sederhana, natural, tetap puitis",
    craft: "Plain everyday words, natural syntax, a light poetic touch. Clarity first; one or two images at most.",
  },
  {
    level: 2,
    key: "2",
    label: "Lyrical",
    hint: "musikal, lembut, kaya gambaran",
    craft: "Musical and soft; attention to sound and flow; richer imagery while staying easy to read.",
  },
  {
    level: 3,
    key: "3",
    label: "Literary",
    hint: "diksi sastrawi, simbol, tersirat",
    craft: "Literary diction chosen for precision, fresh metaphor, symbolism, and meaning left partly beneath the surface.",
  },
  {
    level: 4,
    key: "4",
    label: "Philosophical",
    hint: "kedalaman pikiran, refleksi",
    craft: "Depth of thought: the piece reflects and invites the reader to reflect; ideas carry as much weight as images.",
  },
  {
    level: 5,
    key: "5",
    label: "Classical",
    hint: "nuansa sastra klasik yang elegan",
    craft:
      "An elegant classical literary register: measured cadence, formal grace, careful syntax. Do NOT force archaic or " +
      "obscure vocabulary; elegance comes from structure and restraint, not from old words.",
  },
];

export function depthOf(level: number | null | undefined) {
  return DEPTHS.find((d) => d.level === level) ?? DEPTHS[2];
}

/* ------------------------------------------------------------- controls -- */

export const LENGTHS: Option<"short" | "medium" | "long">[] = [
  { key: "short", label: "Pendek", craft: "short" },
  { key: "medium", label: "Sedang", craft: "medium" },
  { key: "long", label: "Panjang", craft: "long" },
];

/** Concrete length targets per form, so "long" means something. */
export const LENGTH_TARGETS: Record<WorkType, Record<"short" | "medium" | "long", string>> = {
  poetry: { short: "6–10 lines", medium: "12–20 lines in 2–4 stanzas", long: "24–36 lines in 4–6 stanzas" },
  prose: { short: "1 paragraph, ~80–120 words", medium: "2–3 paragraphs, ~180–280 words", long: "4–6 paragraphs, ~350–550 words" },
  letter: { short: "~100–150 words", medium: "~200–320 words", long: "~380–600 words" },
  quote: { short: "1 sentence", medium: "2 sentences", long: "3–4 sentences" },
};

export const LANGUAGES: Option<WordsLanguage>[] = [
  { key: "id", label: "Bahasa Indonesia" },
  { key: "en", label: "English" },
];

export const POVS: Option<"first" | "second" | "third" | "free">[] = [
  { key: "first", label: "Orang pertama", hint: "aku", craft: "first person (aku / I) throughout" },
  { key: "second", label: "Orang kedua", hint: "kamu", craft: "second person: addressed to 'kamu' / 'you' throughout" },
  { key: "third", label: "Orang ketiga", hint: "dia", craft: "third person (dia / she / he / they) throughout" },
  { key: "free", label: "Bebas", craft: "any point of view that serves the piece, but consistent within it" },
];

export const EXPLICITNESS: Option<"explicit" | "balanced" | "implicit">[] = [
  { key: "explicit", label: "Tersurat", hint: "langsung", craft: "Say the feeling plainly and directly; images support, not replace, the statement." },
  { key: "balanced", label: "Seimbang", craft: "Balance what is said and what is implied." },
  { key: "implicit", label: "Tersirat", hint: "lewat simbol", craft: "Never name the central feeling outright; let image, gesture and subtext carry it." },
];

/* --------------------------------------------------------- the rewrite -- */

export const TRANSFORMATIONS: Option[] = [
  { key: "poetic", label: "Make It Poetic", hint: "lebih puitis", craft: "Make the writing more poetic: image, sound, compression. Prose may become verse only if that serves it." },
  { key: "deepen", label: "Deepen the Meaning", hint: "makna lebih dalam", craft: "Deepen the meaning: enrich what is implied, add a layer beneath the surface without adding new facts." },
  { key: "diction", label: "Improve the Diction", hint: "pilihan kata", craft: "Sharpen word choice: replace vague, generic or repeated words with precise ones that have character." },
  { key: "melancholic", label: "Make It Melancholic", hint: "sendu", craft: "Shift the tone toward a quiet, aching melancholy, without changing what happened or what is felt." },
  { key: "romantic", label: "Make It Romantic", hint: "romantis, tak berlebihan", craft: "Strengthen the romantic warmth through specific detail and attention, never through excess or cliché." },
  { key: "philosophical", label: "Make It Philosophical", hint: "reflektif", craft: "Develop the idea into a deeper reflection, opening a question inside it." },
  { key: "intimate", label: "Make It More Intimate", hint: "lebih personal", craft: "Make it more personal, honest and close, as if spoken quietly to one person." },
  { key: "shorten", label: "Shorten Beautifully", hint: "lebih ringkas", craft: "Shorten it substantially while keeping its core and its most beautiful moments. Cut, don't summarise." },
  { key: "expand", label: "Expand into Prose", hint: "jadi prosa utuh", craft: "Develop it into a complete piece of prose with a continuous line of thought, growing only from what is already there." },
  { key: "flow", label: "Improve the Flow", hint: "alur & ritme", craft: "Improve the continuity between sentences and the rhythm, changing as little wording as possible." },
];

export const REFINEMENTS: Option[] = [
  { key: "diction", label: "Diction", hint: "pilihan kata", craft: "diction: precise, characterful word choice" },
  { key: "metaphor", label: "Metaphor", hint: "kiasan", craft: "metaphor: refine and develop figurative language; fresh and relevant to the context" },
  { key: "imagery", label: "Imagery", hint: "penggambaran", craft: "imagery: sharper sensory images (sight, sound, texture, atmosphere)" },
  { key: "rhythm", label: "Rhythm", hint: "irama", craft: "rhythm: cadence and flow of sentences or lines" },
  { key: "symbolism", label: "Symbolism", hint: "simbol", craft: "symbolism: objects or phenomena that carry relevant meaning" },
  { key: "subtext", label: "Subtext", hint: "tersirat", craft: "subtext: convey the feeling more indirectly" },
  { key: "coherence", label: "Coherence", hint: "kesinambungan", craft: "coherence: a continuous line of thought" },
  { key: "progression", label: "Emotional Progression", hint: "emosi bertahap", craft: "emotional progression: feeling develops step by step" },
  { key: "conciseness", label: "Conciseness", hint: "ringkas", craft: "conciseness: remove words that don't earn their place" },
  { key: "emotional_depth", label: "Emotional Depth", hint: "kesan mendalam", craft: "emotional depth: a stronger, truer emotional impression" },
];

/* ------------------------------------------------------------ open when -- */

export const OPEN_WHEN: (Option<OpenWhen> & { emoji: string })[] = [
  { key: "miss_me", label: "Open when you miss me", emoji: "🌙" },
  { key: "tired", label: "Open when you feel tired", emoji: "🫖" },
  { key: "reminder", label: "Open when you need a reminder", emoji: "🎗️" },
  { key: "birthday", label: "Open on your birthday", emoji: "🎂" },
  { key: "courage", label: "Open when you need a little courage", emoji: "🕯️" },
  { key: "right_time", label: "Open when the time is right", emoji: "⏳" },
  { key: "custom", label: "Open when…", emoji: "✉️" },
];

export function openWhenLabel(kind: OpenWhen | null | undefined, custom?: string | null): string | null {
  if (!kind) return null;
  if (kind === "custom") return custom?.trim() ? `Open when ${custom.trim().replace(/^open when\s*/i, "")}` : "Open when…";
  return OPEN_WHEN.find((o) => o.key === kind)?.label ?? null;
}

/* --------------------------------------------------------------- limits -- */

export const WORDS_LIMITS = {
  idea: 1500,
  content: 20000,
  /** What the AI is given to rewrite / explain in one go. */
  aiInput: 6000,
  title: 160,
  intro: 600,
  line: 600,
  instruction: 400,
  customTheme: 160,
  /** Soft cap on AI requests per person per rolling 24h. */
  aiPerDay: 80,
} as const;

export function labelOf(list: Option[], key: string | null | undefined): string | null {
  if (!key) return null;
  return list.find((o) => o.key === key)?.label ?? null;
}
