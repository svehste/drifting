/**
 * Live verification of the cup engine against the real database: lock the demo
 * race, generate its bracket, play it through (lower seed wins), and print the
 * podium. Uses the actual engine (cup-engine.ts). Run: npx tsx src/db/verify-cup.ts
 */
import "./load-env";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { decideInTx, generateCup, loadRanked } from "@/server/cup-engine";
import * as schema from "./schema";

const { battles, cups, events, races, registrations, users } = schema;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  const [event] = await db.select().from(events).where(eq(events.name, "Demo-arrangement"));
  if (!event) throw new Error("Run seed-demo first.");
  const [race] = await db.select().from(races).where(eq(races.eventId, event.id));

  // Simulate the lock + a clean cup.
  await db.update(races).set({ qualifyingLocked: true }).where(eq(races.id, race.id));
  await db.delete(cups).where(eq(cups.raceId, race.id));

  await db.transaction(async (tx) => {
    const ranked = await loadRanked(tx, race.id);
    await generateCup(tx, { id: race.id, cupSize: 8 }, ranked);
    console.log(`✓ Generated bracket for ${ranked.length} eligible drivers.`);
  });

  const seedByReg = new Map<string, number>();
  for (const r of await db.select().from(registrations).where(eq(registrations.raceId, race.id))) {
    if (r.seed !== null) seedByReg.set(r.id, r.seed);
  }
  const seedOf = (id: string) => seedByReg.get(id) ?? 9999;

  // Play: lower seed wins.
  for (let guard = 0; guard < 100; guard++) {
    const pending = await db.select().from(battles).where(eq(battles.cupId, (await db.select().from(cups).where(eq(cups.raceId, race.id)))[0].id));
    const target = pending.find(
      (b) => b.status === "pending" && b.driverARegistrationId && b.driverBRegistrationId,
    );
    if (!target) break;
    const a = seedOf(target.driverARegistrationId!);
    const b = seedOf(target.driverBRegistrationId!);
    await db.transaction((tx) => decideInTx(tx, target.id, a < b ? "a" : "b"));
  }

  const [cup] = await db.select().from(cups).where(eq(cups.raceId, race.id));
  const podium = await db
    .select({ place: registrations.finalPlace, first: users.firstName, last: users.lastName, seed: registrations.seed })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .where(and(eq(registrations.raceId, race.id)));

  console.log(`✓ Cup status: ${cup.status}`);
  console.log("  Placements:");
  podium
    .filter((p) => p.place !== null)
    .sort((x, y) => (x.place ?? 0) - (y.place ?? 0))
    .forEach((p) => console.log(`   ${p.place}. ${p.first} ${p.last} (seed ${p.seed})`));

  console.log(`\n  Public bracket: /lop/${race.id}/cup`);
  await sql.end();
}

main().catch((err) => {
  console.error("verify-cup failed:", err);
  process.exit(1);
});
