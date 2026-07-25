/** Read model for the public cup bracket (Public cup view). Reads cached rows. */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { battles, cups, races, registrations, users } from "@/db/schema";
import { roundsForSize, type BattleRound, type BattleStatus, type CupSize } from "@/domain";

export interface BracketDriver {
  registrationId: string;
  startNumber: string | null;
  name: string;
  seed: number | null;
}

export interface BracketBattle {
  id: string;
  round: BattleRound;
  position: number;
  a: BracketDriver | null;
  b: BracketDriver | null;
  winnerRegistrationId: string | null;
  status: BattleStatus;
  omtCount: number;
}

export interface PodiumEntry {
  place: number;
  name: string;
  startNumber: string | null;
}

export interface BracketData {
  raceId: string;
  raceName: string;
  exists: boolean;
  finished: boolean;
  rounds: { round: BattleRound; battles: BracketBattle[] }[];
  bronsefinal: BracketBattle | null;
  podium: PodiumEntry[];
}

export async function getBracket(raceId: string): Promise<BracketData | null> {
  const [race] = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
  if (!race) return null;

  const [cup] = await db.select().from(cups).where(eq(cups.raceId, raceId)).limit(1);
  if (!cup) {
    return { raceId, raceName: race.name, exists: false, finished: false, rounds: [], bronsefinal: null, podium: [] };
  }

  // Registration → driver display info + seed + final place.
  const regRows = await db
    .select({
      id: registrations.id,
      seed: registrations.seed,
      finalPlace: registrations.finalPlace,
      startNumber: users.startNumber,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .where(eq(registrations.raceId, raceId));
  const regById = new Map(regRows.map((r) => [r.id, r]));

  const toDriver = (regId: string | null): BracketDriver | null => {
    if (!regId) return null;
    const r = regById.get(regId);
    if (!r) return null;
    return {
      registrationId: r.id,
      startNumber: r.startNumber,
      name: `${r.firstName} ${r.lastName}`,
      seed: r.seed,
    };
  };

  const battleRows = await db
    .select()
    .from(battles)
    .where(eq(battles.cupId, cup.id))
    .orderBy(asc(battles.position));

  const toBattle = (b: (typeof battleRows)[number]): BracketBattle => ({
    id: b.id,
    round: b.round,
    position: b.position,
    a: toDriver(b.driverARegistrationId),
    b: toDriver(b.driverBRegistrationId),
    winnerRegistrationId: b.winnerRegistrationId,
    status: b.status,
    omtCount: b.omtCount,
  });

  const order = roundsForSize(Number(cup.size) as CupSize);
  const rounds = order.map((round) => ({
    round,
    battles: battleRows.filter((b) => b.round === round).map(toBattle),
  }));
  const bronse = battleRows.find((b) => b.round === "bronsefinal");

  const podium: PodiumEntry[] = regRows
    .filter((r) => r.finalPlace !== null)
    .sort((a, b) => (a.finalPlace ?? 0) - (b.finalPlace ?? 0))
    .map((r) => ({
      place: r.finalPlace!,
      name: `${r.firstName} ${r.lastName}`,
      startNumber: r.startNumber,
    }));

  return {
    raceId,
    raceName: race.name,
    exists: true,
    finished: cup.status === "finished",
    rounds,
    bronsefinal: bronse ? toBattle(bronse) : null,
    podium,
  };
}
