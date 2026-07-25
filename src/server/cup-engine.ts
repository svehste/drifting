/**
 * Cup engine — the DB-mutating core of bracket generation and battle decisions,
 * factored out of the server actions so it can be integration-tested against a
 * real Postgres engine. No auth here; the actions in actions/cup.ts wrap these
 * with authorization, audit logging, and revalidation.
 */
import { and, eq, or } from "drizzle-orm";
import { battles, cups, races, registrations } from "@/db/schema";
import {
  buildBracket,
  finalPlacements,
  type AdvanceSlot,
  type CupSize,
  type RankedDriver,
} from "@/domain";
import type { Tx } from "./audit";

const ZERO = { total: 0, line: 0, angle: 0, style: 0 };

export interface DecisionResult {
  ok: boolean;
  error?: string;
  raceId: string;
  winner?: string | null;
  round?: string;
}

/** Eligible registrations (rank set) as RankedDriver[] (driverId = registration id). */
export async function loadRanked(tx: Tx, raceId: string): Promise<RankedDriver[]> {
  const regs = await tx
    .select({
      id: registrations.id,
      rank: registrations.qualifyingRank,
      score: registrations.qualifyingScore,
      eligible: registrations.eligible,
    })
    .from(registrations)
    .where(and(eq(registrations.raceId, raceId), eq(registrations.eligible, true)));
  return regs
    .filter((r) => r.rank !== null)
    .map((r) => ({
      driverId: r.id,
      rank: r.rank,
      qualifyingScore: r.score ?? 0,
      hks: ZERO,
      lks: ZERO,
      eligible: true,
    }));
}

/** Insert a freshly built bracket as Battle rows, wiring FK advancement pointers + seeds. */
export async function persistBracket(
  tx: Tx,
  cupId: string,
  ranked: RankedDriver[],
  size: CupSize,
): Promise<void> {
  const built = buildBracket(ranked, size);
  const idByKey = new Map<string, string>();
  for (const b of built.battles) idByKey.set(b.key, crypto.randomUUID());

  await tx.insert(battles).values(
    built.battles.map((b) => ({
      id: idByKey.get(b.key)!,
      cupId,
      round: b.round,
      position: b.position,
      driverARegistrationId: b.driverA,
      driverBRegistrationId: b.driverB,
      winnerRegistrationId: b.winner,
      status: b.status,
      omtCount: 0,
      nextBattleId: b.nextBattleKey ? idByKey.get(b.nextBattleKey)! : null,
      nextSlot: b.nextSlot,
      loserNextBattleId: b.loserNextBattleKey ? idByKey.get(b.loserNextBattleKey)! : null,
      loserNextSlot: b.loserNextSlot,
    })),
  );

  for (const d of ranked) {
    if (d.rank !== null && d.rank <= size) {
      await tx.update(registrations).set({ seed: d.rank }).where(eq(registrations.id, d.driverId));
    }
  }
}

/** Create the cup row + bracket for a race. Returns the new cup id. */
export async function generateCup(
  tx: Tx,
  race: { id: string; cupSize: CupSize },
  ranked: RankedDriver[],
): Promise<string> {
  const [cup] = await tx
    .insert(cups)
    .values({ raceId: race.id, size: String(race.cupSize) as `${CupSize}`, status: "in_progress" })
    .returning();
  await persistBracket(tx, cup.id, ranked, race.cupSize);
  await tx.update(races).set({ status: "cup" }).where(eq(races.id, race.id));
  return cup.id;
}

async function setSlot(tx: Tx, battleId: string, slot: AdvanceSlot, regId: string | null) {
  await tx
    .update(battles)
    .set(slot === "a" ? { driverARegistrationId: regId } : { driverBRegistrationId: regId })
    .where(eq(battles.id, battleId));
}

/**
 * Resolve a target battle that has become a runtime bye: exactly one present
 * driver and the other slot permanently empty (all feeders resolved without
 * delivering a driver). Advances the lone driver and recurses.
 */
async function resolveByes(tx: Tx, battleId: string) {
  const [b] = await tx.select().from(battles).where(eq(battles.id, battleId)).limit(1);
  if (!b || b.status !== "pending") return;

  const drivers = [b.driverARegistrationId, b.driverBRegistrationId].filter(
    (x): x is string => x !== null,
  );
  if (drivers.length === 2) return;

  const slotClosed = async (slot: AdvanceSlot): Promise<boolean> => {
    const filled = slot === "a" ? b.driverARegistrationId : b.driverBRegistrationId;
    if (filled) return true;
    const feeders = await tx
      .select({ status: battles.status })
      .from(battles)
      .where(
        or(
          and(eq(battles.nextBattleId, b.id), eq(battles.nextSlot, slot)),
          and(eq(battles.loserNextBattleId, b.id), eq(battles.loserNextSlot, slot)),
        ),
      );
    if (feeders.length === 0) return true;
    return feeders.every((f) => f.status === "decided" || f.status === "bye");
  };

  if (!(await slotClosed("a")) || !(await slotClosed("b"))) return;

  const winner = drivers[0] ?? null;
  await tx
    .update(battles)
    .set({ status: "bye", winnerRegistrationId: winner })
    .where(eq(battles.id, b.id));
  if (b.nextBattleId && b.nextSlot) {
    await setSlot(tx, b.nextBattleId, b.nextSlot, winner);
    await resolveByes(tx, b.nextBattleId);
  }
}

async function maybeFinishCup(tx: Tx, cupId: string, raceId: string) {
  const cupBattles = await tx.select().from(battles).where(eq(battles.cupId, cupId));
  const find = (r: string) => cupBattles.find((b) => b.round === r);
  const isDone = (b?: (typeof cupBattles)[number]) =>
    b && (b.status === "decided" || b.status === "bye");
  if (!isDone(find("final")) || !isDone(find("bronsefinal"))) return;

  const rankRows = await tx
    .select({ id: registrations.id, rank: registrations.qualifyingRank })
    .from(registrations)
    .where(eq(registrations.raceId, raceId));
  const rankById = new Map(rankRows.map((r) => [r.id, r.rank ?? 9999]));

  const placements = finalPlacements(
    cupBattles.map((b) => ({
      round: b.round,
      driverA: b.driverARegistrationId,
      driverB: b.driverBRegistrationId,
      winner: b.winnerRegistrationId,
    })),
    (id) => rankById.get(id) ?? 9999,
  );
  for (const p of placements) {
    await tx.update(registrations).set({ finalPlace: p.place }).where(eq(registrations.id, p.driverId));
  }
  await tx.update(cups).set({ status: "finished" }).where(eq(cups.id, cupId));
  await tx.update(races).set({ status: "finished" }).where(eq(races.id, raceId));
}

/** Apply a battle decision (a/b/omt) with advancement, bye resolution, and finish check. */
export async function decideInTx(
  tx: Tx,
  battleId: string,
  outcome: "a" | "b" | "omt",
): Promise<DecisionResult> {
  const [b] = await tx.select().from(battles).where(eq(battles.id, battleId)).limit(1);
  if (!b) return { ok: false, error: "not_found", raceId: "" };
  const [cup] = await tx.select().from(cups).where(eq(cups.id, b.cupId)).limit(1);
  const raceId = cup?.raceId ?? "";

  if (outcome === "omt") {
    if (b.omtCount >= 1) return { ok: false, error: "Maks én omkjøring per battle.", raceId };
    await tx
      .update(battles)
      .set({ status: "omt", omtCount: b.omtCount + 1 })
      .where(eq(battles.id, battleId));
    return { ok: true, raceId, round: b.round };
  }

  const winner = outcome === "a" ? b.driverARegistrationId : b.driverBRegistrationId;
  const loser = outcome === "a" ? b.driverBRegistrationId : b.driverARegistrationId;
  if (!winner) return { ok: false, error: "Kan ikke velge en tom slot som vinner.", raceId };

  await tx
    .update(battles)
    .set({ status: "decided", winnerRegistrationId: winner })
    .where(eq(battles.id, battleId));
  if (b.nextBattleId && b.nextSlot) {
    await setSlot(tx, b.nextBattleId, b.nextSlot, winner);
    await resolveByes(tx, b.nextBattleId);
  }
  if (b.loserNextBattleId && b.loserNextSlot) {
    await setSlot(tx, b.loserNextBattleId, b.loserNextSlot, loser);
    await resolveByes(tx, b.loserNextBattleId);
  }
  await maybeFinishCup(tx, b.cupId, raceId);
  return { ok: true, raceId, winner, round: b.round };
}
