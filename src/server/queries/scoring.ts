/** Read model for the judge scoring screen. */
import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { qualifyingRuns, races, registrations, runScores, users } from "@/db/schema";
import type { Criterion, RunStatus } from "@/domain/types";

export interface ScoreValue {
  points: number | null;
  flow: number | null;
  effort: number | null;
  confirmed: boolean;
}

export interface ScoringRun {
  runId: string;
  runNumber: number;
  status: RunStatus;
  total: number | null;
  scores: Record<Criterion, ScoreValue | null>;
}

export interface ScoringRegistration {
  registrationId: string;
  firstName: string;
  lastName: string;
  startNumber: string | null;
  runs: ScoringRun[];
}

export interface ScoringData {
  raceId: string;
  raceName: string;
  qualifyingLocked: boolean;
  maxLine: number;
  maxAngle: number;
  maxStyleFlow: number;
  maxStyleEffort: number;
  registrations: ScoringRegistration[];
}

export async function getScoringData(raceId: string): Promise<ScoringData | null> {
  const [race] = await db.select().from(races).where(eq(races.id, raceId)).limit(1);
  if (!race) return null;

  const regRows = await db
    .select({
      registrationId: registrations.id,
      firstName: users.firstName,
      lastName: users.lastName,
      startNumber: users.startNumber,
    })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .where(eq(registrations.raceId, raceId))
    .orderBy(asc(users.startNumber), asc(users.lastName));

  const regIds = regRows.map((r) => r.registrationId);
  const runs = regIds.length
    ? await db
        .select()
        .from(qualifyingRuns)
        .where(inArray(qualifyingRuns.registrationId, regIds))
        .orderBy(asc(qualifyingRuns.runNumber))
    : [];
  const runIds = runs.map((r) => r.id);
  const scores = runIds.length
    ? await db.select().from(runScores).where(inArray(runScores.runId, runIds))
    : [];

  const scoreByRunCrit = new Map<string, ScoreValue>();
  for (const s of scores) {
    scoreByRunCrit.set(`${s.runId}:${s.criterion}`, {
      points: s.points,
      flow: s.flow,
      effort: s.effort,
      confirmed: s.confirmed,
    });
  }
  const runsByReg = new Map<string, typeof runs>();
  for (const r of runs) {
    if (!runsByReg.has(r.registrationId)) runsByReg.set(r.registrationId, []);
    runsByReg.get(r.registrationId)!.push(r);
  }

  const registrationsOut: ScoringRegistration[] = regRows.map((r) => ({
    registrationId: r.registrationId,
    firstName: r.firstName,
    lastName: r.lastName,
    startNumber: r.startNumber,
    runs: (runsByReg.get(r.registrationId) ?? []).map((run) => ({
      runId: run.id,
      runNumber: run.runNumber,
      status: run.status,
      total: run.total,
      scores: {
        line: scoreByRunCrit.get(`${run.id}:line`) ?? null,
        angle: scoreByRunCrit.get(`${run.id}:angle`) ?? null,
        style: scoreByRunCrit.get(`${run.id}:style`) ?? null,
      },
    })),
  }));

  return {
    raceId: race.id,
    raceName: race.name,
    qualifyingLocked: race.qualifyingLocked,
    maxLine: race.maxLine,
    maxAngle: race.maxAngle,
    maxStyleFlow: race.maxStyleFlow,
    maxStyleEffort: race.maxStyleEffort,
    registrations: registrationsOut,
  };
}
