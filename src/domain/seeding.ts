/**
 * Bracket seeding [stigeoppsett] — the recursive slot-order rule (Bracket
 * seeding AC 3) and the round structure per cup size. Pure & deterministic.
 */
import type { BattleRound, CupSize } from "./types";

/**
 * Standard recursive seeded slot order (Bracket seeding AC 3):
 * begin [1, 2]; to expand to size 2n, replace each seed s with the pair
 * (s, 2n + 1 − s), preserving order.
 *
 *   Top 4:  1-4 2-3           → [1,4,2,3]
 *   Top 8:  1-8 4-5 2-7 3-6   → [1,8,4,5,2,7,3,6]
 *
 * The result is a flat list; consecutive pairs (0,1)(2,3)… are the
 * first-round matchups, and every pair sums to size+1 (AC 4).
 */
export function seedingOrder(size: CupSize): number[] {
  let order = [1, 2];
  let n = 2;
  while (n < size) {
    const next = 2 * n;
    const expanded: number[] = [];
    for (const s of order) {
      expanded.push(s, next + 1 - s);
    }
    order = expanded;
    n = next;
  }
  return order;
}

/**
 * The winner-path rounds for a cup size, first round first, ending in the final.
 * (Bronsefinal is separate — fed by the two semifinal losers.)
 *   32 → top32 → top16 → quarterfinal → semifinal → final
 *   16 →         top16 → quarterfinal → semifinal → final
 *    8 →                 quarterfinal → semifinal → final
 *    4 →                                semifinal → final
 */
export function roundsForSize(size: CupSize): BattleRound[] {
  const all: BattleRound[] = ["top32", "top16", "quarterfinal", "semifinal", "final"];
  const startIndex: Record<CupSize, number> = { 32: 0, 16: 1, 8: 2, 4: 3 };
  return all.slice(startIndex[size]);
}

/** Name of the first (largest) round for a cup size. */
export function firstRoundName(size: CupSize): BattleRound {
  return roundsForSize(size)[0];
}
