/**
 * Integration test for recomputeRace against a real Postgres engine (PGlite):
 * confirmed scores → run completeness/total → registration qualifying caches +
 * HKS/LKS ranking (the M1 functions wired to the DB).
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Tx } from "@/server/audit";
import { recomputeRace } from "@/server/recompute";

const { classes, events, races, users, registrations, qualifyingRuns, runScores } = schema;

let db: ReturnType<typeof drizzle<typeof schema>>;
let raceId: string;
let regA: string;
let regB: string;

async function addRun(regId: string, runNumber: number) {
  const [run] = await db
    .insert(qualifyingRuns)
    .values({ registrationId: regId, runNumber })
    .returning();
  return run.id;
}

async function score(
  runId: string,
  judge: string,
  vals: { line?: number; angle?: number; flow?: number; effort?: number },
  confirmed = true,
) {
  const entries = [
    { criterion: "line" as const, points: vals.line },
    { criterion: "angle" as const, points: vals.angle },
    { criterion: "style" as const, flow: vals.flow, effort: vals.effort },
  ];
  for (const e of entries) {
    if (e.criterion === "style" ? e.flow == null : e.points == null) continue;
    await db.insert(runScores).values({
      runId,
      criterion: e.criterion,
      judgeUserId: judge,
      points: "points" in e ? (e.points ?? null) : null,
      flow: "flow" in e ? (e.flow ?? null) : null,
      effort: "effort" in e ? (e.effort ?? null) : null,
      confirmed,
    });
  }
}

beforeAll(async () => {
  const client = new PGlite();
  await client.exec(readFileSync(resolve(process.cwd(), "drizzle/0000_init.sql"), "utf8"));
  db = drizzle(client, { schema });

  const [cls] = await db.insert(classes).values({ name: "Pro" }).returning();
  const [ev] = await db
    .insert(events)
    .values({ name: "E", startDate: "2026-08-01", endDate: "2026-08-02" })
    .returning();
  const [race] = await db
    .insert(races)
    .values({ eventId: ev.id, name: "R", classId: cls.id, cupSize: "8" })
    .returning();
  raceId = race.id;

  const [ua] = await db
    .insert(users)
    .values({ firstName: "A", lastName: "A", email: "a@x.no" })
    .returning();
  const [ub] = await db
    .insert(users)
    .values({ firstName: "B", lastName: "B", email: "b@x.no" })
    .returning();
  const judge = ua.id;

  [regA, regB] = (
    await db
      .insert(registrations)
      .values([
        { raceId: race.id, userId: ua.id },
        { raceId: race.id, userId: ub.id },
      ])
      .returning()
  ).map((r) => r.id);

  // A: run1 complete = 100; run2 partial (only line) → incomplete.
  const a1 = await addRun(regA, 1);
  const a2 = await addRun(regA, 2);
  await score(a1, judge, { line: 40, angle: 30, flow: 15, effort: 15 });
  await score(a2, judge, { line: 10 }); // incomplete

  // B: run1 complete = 60; run2 complete = 50.
  const b1 = await addRun(regB, 1);
  const b2 = await addRun(regB, 2);
  await score(b1, judge, { line: 20, angle: 20, flow: 10, effort: 10 });
  await score(b2, judge, { line: 15, angle: 20, flow: 8, effort: 7 });

  await db.transaction(async (tx) => {
    await recomputeRace(tx as unknown as Tx, race.id);
  });
});

describe("recomputeRace (M5 wiring of M1)", () => {
  it("sets run completeness and totals", async () => {
    const runs = await db.query.qualifyingRuns.findMany({});
    const byId = new Map(runs.map((r) => [`${r.registrationId}:${r.runNumber}`, r]));
    const a1 = byId.get(`${regA}:1`)!;
    const a2 = byId.get(`${regA}:2`)!;
    expect(a1.status).toBe("complete");
    expect(a1.total).toBe(100);
    expect(a1.approved).toBe(true);
    // Partial run stays pending with no total.
    expect(a2.status).toBe("pending");
    expect(a2.total).toBeNull();
  });

  it("sets registration qualifying_score, eligible, and rank", async () => {
    const a = (await db.select().from(registrations).where(eq(registrations.id, regA)))[0];
    const b = (await db.select().from(registrations).where(eq(registrations.id, regB)))[0];
    expect(a.qualifyingScore).toBe(100);
    expect(a.eligible).toBe(true);
    expect(a.qualifyingRank).toBe(1);
    expect(b.qualifyingScore).toBe(60); // best of 60/50
    expect(b.qualifyingRank).toBe(2);
  });
});
