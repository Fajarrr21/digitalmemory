import { BANK, WILD_CHANCE, type CategoryKey, type ChallengeKind, type DiceMode, type WildKey } from "./config";

/** A dealt challenge as it lives on the game row (text is copied, so edits never rewrite a game). */
export type DiceCard = { key: string; text: string; kind: ChallengeKind; by?: string; secret?: boolean };

/** The open roll on a game. `cards` is empty while a Your Choice card waits for a pick. */
export type DiceCurrent = {
  id: string;
  face: number | null;
  category: CategoryKey | null;
  wild: WildKey | null;
  cards: DiceCard[];
  partnerAnswer?: string | null;
  rolledAt: string;
  /** Ular Tangga: which square dealt this card, and where the pawn goes after it */
  board?: { event: "snake" | "ladder" | "heart"; landed: number; to: number };
};

export type CustomChallenge = {
  id: string;
  author_id: string;
  category: string;
  modes: string[];
  kind: ChallengeKind;
  text: string;
  secret: boolean;
};

type Rand = () => number;

/** A fair 1–6 from a uniform [0,1) source. */
export const faceFrom = (rand: Rand) => Math.floor(rand() * 6) + 1;

/** Usually nothing; now and then a wild card (each of the four equally likely). */
export function drawWild(rand: Rand): WildKey | null {
  if (rand() >= WILD_CHANCE) return null;
  const all: WildKey[] = ["switch", "double", "choice", "heart"];
  return all[Math.floor(rand() * all.length)];
}

/**
 * Candidates for one face: the bank + custom challenges in that category.
 * A custom challenge is written FOR your partner, so it's only dealt to them.
 */
export function poolFor(category: CategoryKey, rollerId: string, customs: CustomChallenge[]) {
  const bank = BANK.filter((b) => b.category === category).map((b) => ({
    card: { key: b.key, text: b.text, kind: b.kind } as DiceCard,
    modes: b.modes as string[],
  }));
  const mine = customs
    .filter((c) => c.category === category && c.author_id !== rollerId)
    .map((c) => ({
      card: { key: `c:${c.id}`, text: c.text, kind: c.kind, by: c.author_id, secret: c.secret } as DiceCard,
      modes: c.modes,
    }));
  return [...mine, ...bank];
}

/**
 * Deal `n` different challenges: unseen ones in this mode first, then unseen
 * ones from other modes, and only when the whole category is used up does
 * anything repeat. Custom challenges get a little extra weight — someone wrote
 * them on purpose.
 */
export function dealCards(
  pool: ReturnType<typeof poolFor>,
  mode: DiceMode,
  seen: string[],
  rand: Rand,
  n = 1,
): DiceCard[] {
  const seenSet = new Set(seen);
  const out: DiceCard[] = [];
  const taken = new Set<string>();
  for (let k = 0; k < n; k++) {
    const free = pool.filter((p) => !taken.has(p.card.key));
    const tiers = [
      free.filter((p) => p.modes.includes(mode) && !seenSet.has(p.card.key)),
      free.filter((p) => !seenSet.has(p.card.key)),
      free.filter((p) => p.modes.includes(mode)),
      free,
    ];
    const tier = tiers.find((t) => t.length > 0);
    if (!tier) break;
    const weighted = tier.flatMap((p) => (p.card.key.startsWith("c:") ? [p, p, p] : [p]));
    const pick = weighted[Math.floor(rand() * weighted.length)];
    taken.add(pick.card.key);
    out.push(pick.card);
  }
  return out;
}
