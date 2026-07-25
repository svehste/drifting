/**
 * Demo data for live verification / a visual walkthrough. Creates one event with
 * a Pro race, five drivers, two qualifying runs each with confirmed scores, and
 * computes the qualifying caches with the M1 pure functions (mirroring
 * recomputeRace). Idempotent by event name. Run: npx tsx src/db/seed-demo.ts
 *
 * Remove it anytime by deleting the "Demo-arrangement" event in the admin UI.
 */
import "./load-env";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { rankDrivers, runTotal, type RunInput } from "../domain";
import {
  classes,
  events,
  qualifyingRuns,
  races,
  registrations,
  runScores,
  userRoles,
  users,
} from "./schema";

const EVENT_NAME = "Demo-arrangement";

// [startNumber, first, last, club, car, run1(L,A,flow,effort), run2(...)]
const DRIVERS: Array<{
  n: string;
  first: string;
  last: string;
  club: string;
  car: string;
  r1: RunInput;
  r2: RunInput;
}> = [
  { n: "7", first: "Kari", last: "Nordmann", club: "Oslo BK", car: "Nissan S15", r1: { line: 38, angle: 28, flow: 14, effort: 13 }, r2: { line: 40, angle: 29, flow: 15, effort: 14 } },
  { n: "13", first: "Ola", last: "Hansen", club: "Bergen MK", car: "BMW E46", r1: { line: 35, angle: 27, flow: 13, effort: 12 }, r2: { line: 33, angle: 25, flow: 12, effort: 11 } },
  { n: "3", first: "Per", last: "Berg", club: "Trondheim MS", car: "Toyota Supra", r1: { line: 40, angle: 30, flow: 15, effort: 15 }, r2: { line: 39, angle: 30, flow: 14, effort: 15 } },
  { n: "21", first: "Nils", last: "Dahl", club: "Stavanger BK", car: "Mazda RX-7", r1: { line: 30, angle: 22, flow: 10, effort: 10 }, r2: { line: 32, angle: 24, flow: 11, effort: 11 } },
  { n: "9", first: "Mia", last: "Lie", club: "Oslo BK", car: "Nissan 350Z", r1: { line: 0, angle: 0, flow: 0, effort: 0 }, r2: { line: 36, angle: 26, flow: 13, effort: 12 } },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql, {
    schema: { classes, events, races, registrations, qualifyingRuns, runScores, users, userRoles },
  });

  const [pro] = await db
    .insert(classes)
    .values({ name: "Pro", sortOrder: 1 })
    .onConflictDoNothing({ target: classes.name })
    .returning();
  const proId = pro?.id ?? (await db.select().from(classes).where(eq(classes.name, "Pro")))[0].id;

  // Fresh event each run.
  await db.delete(events).where(eq(events.name, EVENT_NAME));
  const [event] = await db
    .insert(events)
    .values({ name: EVENT_NAME, startDate: "2026-08-15", endDate: "2026-08-16", status: "ongoing" })
    .returning();
  const [race] = await db
    .insert(races)
    .values({ eventId: event.id, name: "Pro 1", classId: proId, cupSize: "8", status: "qualifying" })
    .returning();

  // A judge to attribute scores to.
  const judgeEmail = "demo.judge@example.com";
  await db
    .insert(users)
    .values({ firstName: "Demo", lastName: "Dommer", email: judgeEmail })
    .onConflictDoNothing({ target: users.email });
  const judgeId = (await db.select().from(users).where(eq(users.email, judgeEmail)))[0].id;
  await db.insert(userRoles).values({ userId: judgeId, role: "judge" }).onConflictDoNothing();

  const rankInput = [];
  for (const d of DRIVERS) {
    const email = `demo.${d.n}@example.com`;
    await db
      .insert(users)
      .values({ firstName: d.first, lastName: d.last, email, club: d.club, car: d.car, startNumber: d.n })
      .onConflictDoUpdate({ target: users.email, set: { startNumber: d.n, club: d.club, car: d.car } });
    const userId = (await db.select().from(users).where(eq(users.email, email)))[0].id;
    await db.insert(userRoles).values({ userId, role: "driver" }).onConflictDoNothing();

    const [reg] = await db.insert(registrations).values({ raceId: race.id, userId }).returning();

    const runIds: string[] = [];
    for (const [i, input] of [d.r1, d.r2].entries()) {
      const [run] = await db
        .insert(qualifyingRuns)
        .values({ registrationId: reg.id, runNumber: i + 1 })
        .returning();
      runIds.push(run.id);
      await db.insert(runScores).values([
        { runId: run.id, criterion: "line", judgeUserId: judgeId, points: input.line, confirmed: true },
        { runId: run.id, criterion: "angle", judgeUserId: judgeId, points: input.angle, confirmed: true },
        { runId: run.id, criterion: "style", judgeUserId: judgeId, flow: input.flow, effort: input.effort, confirmed: true },
      ]);
      const total = runTotal(input);
      await db
        .update(qualifyingRuns)
        .set({ status: "complete", total, approved: total > 0 })
        .where(eq(qualifyingRuns.id, run.id));
    }
    rankInput.push({ driverId: reg.id, runs: [d.r1, d.r2] });
  }

  // Compute ranking with the same M1 function recomputeRace uses.
  for (const d of rankDrivers(rankInput)) {
    await db
      .update(registrations)
      .set({ qualifyingScore: d.eligible ? d.qualifyingScore : null, qualifyingRank: d.rank, eligible: d.eligible })
      .where(eq(registrations.id, d.driverId));
  }

  await sql.end();
  console.log(`✓ Demo ready. Race id: ${race.id}`);
  console.log(`  Leaderboard: /lop/${race.id}/resultater`);
  console.log(`  Admin race:  /admin/lop/${race.id}`);
}

main().catch((err) => {
  console.error("seed-demo failed:", err);
  process.exit(1);
});
