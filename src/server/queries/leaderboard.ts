/** Read model for the public leaderboard (Leaderboard AC 2). Reads cached values. */
import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { qualifyingRuns, races, registrations, runScores, users } from "@/db/schema";
import type { LeaderboardStatus } from "@/domain/types";

export interface RunCell {
  complete: boolean;
  line: number | null;
  angle: number | null;
  style: number | null;
  total: number | null;
  approved: boolean;
}

export interface LeaderboardRow {
  registrationId: string;
  rank: number | null;
  startNumber: string | null;
  startNumberIsDummy: boolean;
  firstName: string;
  lastName: string;
  club: string | null;
  car: string | null;
  runs: RunCell[];
  best: number | null;
  eligible: boolean;
}

export interface LeaderboardData {
  raceId: string;
  raceName: string;
  status: LeaderboardStatus;
  qualifyingLocked: boolean;
  rows: LeaderboardRow[];
}

const emptyCell: RunCell = { complete: false, line: null, angle: null, style: null, total: null, approved: false };

export async function getLeaderboard(raceId: string): Promise<LeaderboardData | null> {
  const [race] = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
  if (!race) return null;

  const regRows = await db
    .select({
      registrationId: registrations.id,
      rank: registrations.qualifyingRank,
      best: registrations.qualifyingScore,
      eligible: registrations.eligible,
      firstName: users.firstName,
      lastName: users.lastName,
      startNumber: users.startNumber,
      startNumberIsDummy: users.startNumberIsDummy,
      club: users.club,
      car: users.car,
    })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .where(eq(registrations.raceId, raceId))
    .orderBy(sql`${registrations.qualifyingRank} asc nulls last`, asc(users.startNumber));

  const regIds = regRows.map((r) => r.registrationId);
  const runs = regIds.length
    ? await db.select().from(qualifyingRuns).where(inArray(qualifyingRuns.registrationId, regIds))
    : [];
  const runIds = runs.map((r) => r.id);
  const scores = runIds.length
    ? await db.select().from(runScores).where(inArray(runScores.runId, runIds))
    : [];

  const scoresByRun = new Map<string, typeof scores>();
  for (const s of scores) {
    if (!scoresByRun.has(s.runId)) scoresByRun.set(s.runId, []);
    scoresByRun.get(s.runId)!.push(s);
  }
  const runsByReg = new Map<string, typeof runs>();
  for (const r of runs) {
    if (!runsByReg.has(r.registrationId)) runsByReg.set(r.registrationId, []);
    runsByReg.get(r.registrationId)!.push(r);
  }

  const toCell = (run: (typeof runs)[number]): RunCell => {
    if (run.status !== "complete") return emptyCell;
    const rs = scoresByRun.get(run.id) ?? [];
    const byCrit = new Map(rs.map((s) => [s.criterion, s]));
    const style = byCrit.get("style");
    return {
      complete: true,
      line: byCrit.get("line")?.points ?? null,
      angle: byCrit.get("angle")?.points ?? null,
      style: style ? (style.flow ?? 0) + (style.effort ?? 0) : null,
      total: run.total,
      approved: run.approved,
    };
  };

  const rows: LeaderboardRow[] = regRows.map((r) => {
    const regRuns = (runsByReg.get(r.registrationId) ?? []).sort((a, b) => a.runNumber - b.runNumber);
    const cells = [1, 2].map((n) => {
      const run = regRuns.find((x) => x.runNumber === n);
      return run ? toCell(run) : emptyCell;
    });
    return {
      registrationId: r.registrationId,
      rank: r.rank,
      startNumber: r.startNumber,
      startNumberIsDummy: r.startNumberIsDummy,
      firstName: r.firstName,
      lastName: r.lastName,
      club: r.club,
      car: r.car,
      runs: cells,
      best: r.best,
      eligible: r.eligible,
    };
  });

  return {
    raceId: race.id,
    raceName: race.name,
    status: race.leaderboardStatus,
    qualifyingLocked: race.qualifyingLocked,
    rows,
  };
}
