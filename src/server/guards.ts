/**
 * Deletion guards (Events AC 6, Races AC 8, Drivers AC 7): an event, race, or
 * driver with any results — a confirmed qualifying score or a decided battle —
 * cannot be deleted, so history is preserved.
 */
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  battles,
  cups,
  qualifyingRuns,
  races,
  registrations,
  runScores,
} from "@/db/schema";

async function any(query: Promise<{ id: string }[]>): Promise<boolean> {
  return (await query).length > 0;
}

/** Confirmed run score under any registration of this race. */
async function raceHasConfirmedScore(raceId: string): Promise<boolean> {
  return any(
    db
      .select({ id: runScores.id })
      .from(runScores)
      .innerJoin(qualifyingRuns, eq(qualifyingRuns.id, runScores.runId))
      .innerJoin(registrations, eq(registrations.id, qualifyingRuns.registrationId))
      .where(and(eq(registrations.raceId, raceId), eq(runScores.confirmed, true)))
      .limit(1),
  );
}

/** A decided (contested) battle in this race's cup. */
async function raceHasDecidedBattle(raceId: string): Promise<boolean> {
  return any(
    db
      .select({ id: battles.id })
      .from(battles)
      .innerJoin(cups, eq(cups.id, battles.cupId))
      .where(and(eq(cups.raceId, raceId), eq(battles.status, "decided")))
      .limit(1),
  );
}

export async function raceHasResults(raceId: string): Promise<boolean> {
  return (await raceHasConfirmedScore(raceId)) || (await raceHasDecidedBattle(raceId));
}

/** An event has results if any of its races does. */
export async function eventHasResults(eventId: string): Promise<boolean> {
  const raceRows = await db
    .select({ id: races.id })
    .from(races)
    .where(eq(races.eventId, eventId));
  for (const r of raceRows) {
    if (await raceHasResults(r.id)) return true;
  }
  return false;
}

/** A driver has results if any of their registrations has a confirmed score or a decided battle. */
export async function driverHasResults(userId: string): Promise<boolean> {
  const regRows = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.userId, userId));
  if (regRows.length === 0) return false;
  const regIds = regRows.map((r) => r.id);

  const confirmed = await any(
    db
      .select({ id: runScores.id })
      .from(runScores)
      .innerJoin(qualifyingRuns, eq(qualifyingRuns.id, runScores.runId))
      .where(and(inArray(qualifyingRuns.registrationId, regIds), eq(runScores.confirmed, true)))
      .limit(1),
  );
  if (confirmed) return true;

  return any(
    db
      .select({ id: battles.id })
      .from(battles)
      .where(and(eq(battles.status, "decided"), inArray(battles.winnerRegistrationId, regIds)))
      .limit(1),
  );
}
