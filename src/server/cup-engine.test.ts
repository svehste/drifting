/**
 * Integration test for the cup engine against a real Postgres engine (PGlite):
 * generate an 8-bracket, play it (lower seed wins), and assert advancement, the
 * OMT cap, final placements, and cup/race completion — the DB wiring of M1's
 * buildBracket + finalPlacements.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq, isNotNull } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Tx } from "@/server/audit";
import { decideInTx, generateCup, loadRanked } from "@/server/cup-engine";

const { classes, events, races, users, registrations, battles, cups } = schema;

let db: ReturnType<typeof drizzle<typeof schema>>;
let raceId: string;
const seedByReg = new Map<string, number>();

const tx = (fn: (t: Tx) => Promise<unknown>) => db.transaction((t) => fn(t as unknown as Tx));

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
    .values({ eventId: ev.id, name: "R", classId: cls.id, cupSize: "8", qualifyingLocked: true })
    .returning();
  raceId = race.id;

  // 8 eligible drivers, rank = seed 1..8.
  for (let i = 1; i <= 8; i++) {
    const [u] = await db
      .insert(users)
      .values({ firstName: `D${i}`, lastName: "x", email: `d${i}@x.no` })
      .returning();
    await db.insert(registrations).values({
      raceId: race.id,
      userId: u.id,
      qualifyingRank: i,
      qualifyingScore: 1000 - i,
      eligible: true,
    });
  }

  await tx(async (t) => {
    const ranked = await loadRanked(t, race.id);
    await generateCup(t, { id: race.id, cupSize: 8 }, ranked);
  });

  for (const r of await db.select().from(registrations).where(eq(registrations.raceId, race.id))) {
    if (r.seed !== null) seedByReg.set(r.id, r.seed);
  }
});

const seedOf = (regId: string) => seedByReg.get(regId) ?? 9999;

describe("cup engine", () => {
  it("generates a full 8-bracket (quarterfinal seeding by rank)", async () => {
    const rows = await db
      .select()
      .from(battles)
      .where(eq(battles.round, "quarterfinal"))
      .orderBy(battles.position);
    expect(rows).toHaveLength(4);
    // seedingOrder(8) = [1,8,4,5,2,7,3,6]
    const pairs = rows.map((b) => [seedOf(b.driverARegistrationId!), seedOf(b.driverBRegistrationId!)]);
    expect(pairs).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
  });

  it("caps OMT at one per battle", async () => {
    const [qf] = await db
      .select()
      .from(battles)
      .where(eq(battles.round, "quarterfinal"))
      .orderBy(battles.position)
      .limit(1);

    await tx((t) => decideInTx(t as unknown as Tx, qf.id, "omt"));
    const res = (await db.select({ omt: battles.omtCount, status: battles.status }).from(battles).where(eq(battles.id, qf.id)))[0];
    expect(res.omt).toBe(1);
    expect(res.status).toBe("omt");

    const second = (await tx((t) => decideInTx(t as unknown as Tx, qf.id, "omt"))) as {
      ok: boolean;
    };
    expect(second.ok).toBe(false); // second OMT rejected
  });

  it("plays through to a podium with placements 1..8 by seed", async () => {
    // Lower seed always wins. Repeatedly decide any pending battle with two drivers.
    for (let guard = 0; guard < 200; guard++) {
      const pending = await db.select().from(battles).where(eq(battles.status, "pending"));
      const actionable = pending.find(
        (b) => b.driverARegistrationId && b.driverBRegistrationId,
      );
      // Also handle the OMT'd battle from the previous test.
      const omt = (await db.select().from(battles).where(eq(battles.status, "omt")))[0];
      const target = actionable ?? omt;
      if (!target) break;
      const a = seedOf(target.driverARegistrationId!);
      const b = seedOf(target.driverBRegistrationId!);
      await tx((t) => decideInTx(t as unknown as Tx, target.id, a < b ? "a" : "b"));
    }

    const [cup] = await db.select().from(cups).where(eq(cups.raceId, raceId));
    expect(cup.status).toBe("finished");
    const [race] = await db.select().from(races).where(eq(races.id, raceId));
    expect(race.status).toBe("finished");

    const placed = await db
      .select({ id: registrations.id, place: registrations.finalPlace })
      .from(registrations)
      .where(and(eq(registrations.raceId, raceId), isNotNull(registrations.finalPlace)));
    const placeBySeed = new Map(placed.map((p) => [seedOf(p.id), p.place]));
    // Lower seed wins everywhere → final placement equals seed.
    for (let seed = 1; seed <= 8; seed++) {
      expect(placeBySeed.get(seed)).toBe(seed);
    }
  });
});
