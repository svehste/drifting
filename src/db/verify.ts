/**
 * One-off live verification of the write path + deletion guards against the real
 * database. Self-contained (its own connection) so it runs under tsx without
 * Next's "server-only" shim; the guard queries mirror src/server/guards.ts.
 * Run: npx tsx src/db/verify.ts
 */
import "./load-env";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  battles,
  classes,
  cups,
  events,
  qualifyingRuns,
  races,
  registrations,
  runScores,
  userRoles,
  users,
} from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");
const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql, { schema: { classes, events, races, registrations, qualifyingRuns, runScores, users, userRoles, cups, battles } });

const exists = async (q: Promise<{ id: string }[]>) => (await q).length > 0;

async function raceHasResults(raceId: string) {
  const score = await exists(
    db
      .select({ id: runScores.id })
      .from(runScores)
      .innerJoin(qualifyingRuns, eq(qualifyingRuns.id, runScores.runId))
      .innerJoin(registrations, eq(registrations.id, qualifyingRuns.registrationId))
      .where(and(eq(registrations.raceId, raceId), eq(runScores.confirmed, true)))
      .limit(1),
  );
  if (score) return true;
  return exists(
    db
      .select({ id: battles.id })
      .from(battles)
      .innerJoin(cups, eq(cups.id, battles.cupId))
      .where(and(eq(cups.raceId, raceId), eq(battles.status, "decided")))
      .limit(1),
  );
}

async function eventHasResults(eventId: string) {
  const raceRows = await db.select({ id: races.id }).from(races).where(eq(races.eventId, eventId));
  for (const r of raceRows) if (await raceHasResults(r.id)) return true;
  return false;
}

async function driverHasResults(userId: string) {
  const regRows = await db.select({ id: registrations.id }).from(registrations).where(eq(registrations.userId, userId));
  if (regRows.length === 0) return false;
  const regIds = regRows.map((r) => r.id);
  return exists(
    db
      .select({ id: runScores.id })
      .from(runScores)
      .innerJoin(qualifyingRuns, eq(qualifyingRuns.id, runScores.runId))
      .where(and(inArray(qualifyingRuns.registrationId, regIds), eq(runScores.confirmed, true)))
      .limit(1),
  );
}

function assert(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const [pro] = await db.select().from(classes).where(eq(classes.name, "Pro")).limit(1);
  if (!pro) throw new Error("seed missing Pro class");

  const [ev] = await db
    .insert(events)
    .values({ name: "VERIFY (temp)", startDate: "2026-08-01", endDate: "2026-08-02" })
    .returning();
  const [race] = await db
    .insert(races)
    .values({ eventId: ev.id, name: "Verify race", classId: pro.id, cupSize: "8" })
    .returning();
  const [driver] = await db
    .insert(users)
    .values({ firstName: "Verify", lastName: "Driver", email: `verify+${Date.now()}@example.com` })
    .returning();
  await db.insert(userRoles).values({ userId: driver.id, role: "driver" });
  const [reg] = await db.insert(registrations).values({ raceId: race.id, userId: driver.id }).returning();
  const [run] = await db.insert(qualifyingRuns).values({ registrationId: reg.id, runNumber: 1 }).returning();

  assert("empty event has no results", (await eventHasResults(ev.id)) === false);

  await db
    .insert(runScores)
    .values({ runId: run.id, criterion: "line", judgeUserId: driver.id, points: 20, confirmed: true });

  assert("raceHasResults after a confirmed score", (await raceHasResults(race.id)) === true);
  assert("eventHasResults after a confirmed score", (await eventHasResults(ev.id)) === true);
  assert("driverHasResults after a confirmed score", (await driverHasResults(driver.id)) === true);

  let blocked = false;
  try {
    await db.delete(classes).where(eq(classes.id, pro.id));
  } catch {
    blocked = true;
  }
  assert("class in use cannot be deleted (FK restrict)", blocked);

  await db.delete(events).where(eq(events.id, ev.id));
  await db.delete(users).where(eq(users.id, driver.id));
  assert(
    "cleanup removed the event",
    (await db.select().from(events).where(eq(events.id, ev.id))).length === 0,
  );

  await sql.end();
  console.log("done.");
}

main().catch((err) => {
  console.error("verify failed:", err);
  process.exit(1);
});
