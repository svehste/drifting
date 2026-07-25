/**
 * Bracket generation [stigegenerering] — builds the full fixed single-elimination
 * tree (Bracket seeding AC 1–8), including byes and the bronsefinal. Pure.
 *
 * Advancement is fixed at generation: every battle knows where its winner goes
 * (`nextBattleKey`/`nextSlot`), and each semifinal knows where its loser goes
 * (`loserNextBattleKey`/`loserNextSlot` → bronsefinal). There is no re-seeding.
 *
 * Byes are resolved at generation: a battle facing an empty slot auto-advances
 * its present driver, cascading through empty regions of the tree. This is why a
 * Top-32 stige seeded with 16 drivers collapses its first round to byes.
 */
import type { RankedDriver } from "./ranking";
import { roundsForSize, seedingOrder } from "./seeding";
import type { AdvanceSlot, BattleRound, BattleStatus, CupSize } from "./types";

/** Stable key `${round}#${position}` used to wire the tree before it hits the DB. */
export type BattleKey = string;

export interface BuiltBattle {
  key: BattleKey;
  round: BattleRound;
  position: number;
  /** Driver ids (registration/driver token). Null = empty slot / to-be-filled. */
  driverA: string | null;
  driverB: string | null;
  /** Auto-set for byes; otherwise null until the battle is decided at runtime. */
  winner: string | null;
  status: BattleStatus;
  nextBattleKey: BattleKey | null;
  nextSlot: AdvanceSlot | null;
  loserNextBattleKey: BattleKey | null;
  loserNextSlot: AdvanceSlot | null;
}

export interface BuiltBracket {
  size: CupSize;
  battles: BuiltBattle[];
}

/**
 * A slot's state during generation. `driver` = a concrete driver present now;
 * `empty` = determined empty (no one can ever fill it); `unknown` = will be
 * filled at runtime by an undecided upstream battle. Both `empty` and `unknown`
 * serialize to a null driver id — the distinction only drives bye classification.
 */
type Slot =
  | { kind: "driver"; id: string }
  | { kind: "empty" }
  | { kind: "unknown" };

const EMPTY: Slot = { kind: "empty" };
const UNKNOWN: Slot = { kind: "unknown" };

const key = (round: BattleRound, position: number): BattleKey => `${round}#${position}`;

export function buildBracket(ranked: RankedDriver[], size: CupSize): BuiltBracket {
  const rounds = roundsForSize(size);
  const eligible = ranked.filter((d) => d.eligible && d.rank !== null);

  // seed (1-based) → driver id, only the top N seeds enter the cup (AC 7).
  const seededId = (seed: number): string | null => {
    const d = eligible.find((r) => r.rank === seed);
    return d ? d.driverId : null;
  };

  // Working slot state per battle, keyed by battle key.
  const slotsA = new Map<BattleKey, Slot>();
  const slotsB = new Map<BattleKey, Slot>();
  const battles = new Map<BattleKey, BuiltBattle>();

  const numBattlesInRound = (roundIndex: number): number => (size >> roundIndex) / 2;

  // 1) Create winner-path battles with their advancement wiring.
  rounds.forEach((round, ri) => {
    const count = numBattlesInRound(ri);
    for (let p = 0; p < count; p++) {
      const k = key(round, p);
      let nextBattleKey: BattleKey | null = null;
      let nextSlot: AdvanceSlot | null = null;
      if (ri < rounds.length - 1) {
        nextBattleKey = key(rounds[ri + 1], Math.floor(p / 2));
        nextSlot = p % 2 === 0 ? "a" : "b";
      }
      battles.set(k, {
        key: k,
        round,
        position: p,
        driverA: null,
        driverB: null,
        winner: null,
        status: "pending",
        nextBattleKey,
        nextSlot,
        loserNextBattleKey: null,
        loserNextSlot: null,
      });
      slotsA.set(k, UNKNOWN);
      slotsB.set(k, UNKNOWN);
    }
  });

  // 2) Bronsefinal (always present — every cup size has a semifinal).
  const bronseKey = key("bronsefinal", 0);
  battles.set(bronseKey, {
    key: bronseKey,
    round: "bronsefinal",
    position: 0,
    driverA: null,
    driverB: null,
    winner: null,
    status: "pending",
    nextBattleKey: null,
    nextSlot: null,
    loserNextBattleKey: null,
    loserNextSlot: null,
  });
  slotsA.set(bronseKey, UNKNOWN);
  slotsB.set(bronseKey, UNKNOWN);
  // Wire the two semifinal losers into the bronsefinal.
  battles.get(key("semifinal", 0))!.loserNextBattleKey = bronseKey;
  battles.get(key("semifinal", 0))!.loserNextSlot = "a";
  battles.get(key("semifinal", 1))!.loserNextBattleKey = bronseKey;
  battles.get(key("semifinal", 1))!.loserNextSlot = "b";

  // 3) Seed the first round from the recursive slot order.
  const order = seedingOrder(size);
  const first = rounds[0];
  for (let p = 0; p < size / 2; p++) {
    const seedA = order[2 * p];
    const seedB = order[2 * p + 1];
    const idA = seededId(seedA);
    const idB = seededId(seedB);
    slotsA.set(key(first, p), idA ? { kind: "driver", id: idA } : EMPTY);
    slotsB.set(key(first, p), idB ? { kind: "driver", id: idB } : EMPTY);
  }

  const setSlot = (battleKey: BattleKey, slot: AdvanceSlot, value: Slot) => {
    (slot === "a" ? slotsA : slotsB).set(battleKey, value);
  };

  // 4) Classify each winner-path battle in round order, resolving byes and
  //    pushing the winner (and, for semifinals, the loser) forward.
  rounds.forEach((round, ri) => {
    const count = numBattlesInRound(ri);
    for (let p = 0; p < count; p++) {
      const k = key(round, p);
      const b = battles.get(k)!;
      const a = slotsA.get(k)!;
      const bb = slotsB.get(k)!;
      const { winnerAdvancer, loserAdvancer } = classify(b, a, bb);

      if (b.nextBattleKey && b.nextSlot) {
        setSlot(b.nextBattleKey, b.nextSlot, winnerAdvancer);
      }
      if (round === "semifinal" && b.loserNextBattleKey && b.loserNextSlot) {
        setSlot(b.loserNextBattleKey, b.loserNextSlot, loserAdvancer);
      }
    }
  });

  // 5) Classify the bronsefinal last (its slots are now set from semifinal losers).
  const bronse = battles.get(bronseKey)!;
  classify(bronse, slotsA.get(bronseKey)!, slotsB.get(bronseKey)!);

  return { size, battles: [...battles.values()] };
}

/**
 * Set a battle's driverA/driverB/status/winner from its two slots and return the
 * state that advances onward. Mutates `b`.
 */
function classify(
  b: BuiltBattle,
  a: Slot,
  bb: Slot,
): { winnerAdvancer: Slot; loserAdvancer: Slot } {
  b.driverA = a.kind === "driver" ? a.id : null;
  b.driverB = bb.kind === "driver" ? bb.id : null;

  const drivers = [a, bb].filter((s): s is { kind: "driver"; id: string } => s.kind === "driver");
  const anyUnknown = a.kind === "unknown" || bb.kind === "unknown";

  if (drivers.length === 2) {
    // Two real drivers → a live battle whose winner/loser are decided at runtime.
    b.status = "pending";
    b.winner = null;
    return { winnerAdvancer: UNKNOWN, loserAdvancer: UNKNOWN };
  }

  if (anyUnknown) {
    // Depends on an undecided upstream battle → still live; nothing concrete to
    // push yet. (A lone driver here + an unknown sibling is a runtime bye.)
    b.status = "pending";
    b.winner = null;
    return { winnerAdvancer: UNKNOWN, loserAdvancer: UNKNOWN };
  }

  // No unknowns and fewer than two drivers → determined at generation.
  if (drivers.length === 1) {
    // Bye: the present driver advances automatically (no battle contested).
    b.status = "bye";
    b.winner = drivers[0].id;
    return { winnerAdvancer: { kind: "driver", id: drivers[0].id }, loserAdvancer: EMPTY };
  }

  // Both empty → a structural placeholder that advances nothing.
  b.status = "bye";
  b.winner = null;
  return { winnerAdvancer: EMPTY, loserAdvancer: EMPTY };
}
