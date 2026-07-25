/**
 * Schema verification (M2 DoD): the generated migration applies cleanly to a real
 * Postgres engine (PGlite, in-memory) and the unique constraints actually reject
 * duplicate inserts. This runs as part of `npm test`.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let pg: PGlite;

/** A driver.id/class.id etc. captured while seeding minimal rows. */
const ids: Record<string, string> = {};

async function expectReject(fn: () => Promise<unknown>) {
  await expect(fn()).rejects.toBeTruthy();
}

beforeAll(async () => {
  pg = new PGlite();
  const migration = readFileSync(resolve(process.cwd(), "drizzle/0000_init.sql"), "utf8");
  // The whole file is valid multi-statement SQL; drizzle's breakpoint markers are
  // line comments (`-->`), so PGlite executes it as-is.
  await pg.exec(migration);

  // Minimal fixtures to exercise the composite constraints.
  const cls = await pg.query<{ id: string }>(
    "insert into classes (name) values ('Pro') returning id",
  );
  ids.class = cls.rows[0].id;

  const ev = await pg.query<{ id: string }>(
    "insert into events (name, start_date, end_date) values ('Test', '2026-08-01', '2026-08-02') returning id",
  );
  ids.event = ev.rows[0].id;

  const race = await pg.query<{ id: string }>(
    "insert into races (event_id, name, class_id, cup_size) values ($1, 'Pro 1', $2, '8') returning id",
    [ids.event, ids.class],
  );
  ids.race = race.rows[0].id;

  for (const [key, email] of [
    ["judgeA", "a@x.no"],
    ["judgeB", "b@x.no"],
    ["driver", "d@x.no"],
  ] as const) {
    const u = await pg.query<{ id: string }>(
      "insert into users (first_name, last_name, email) values ('F', 'L', $1) returning id",
      [email],
    );
    ids[key] = u.rows[0].id;
  }
});

afterAll(async () => {
  await pg?.close();
});

describe("migration & schema", () => {
  it("creates all 13 tables", async () => {
    const r = await pg.query<{ n: number }>(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
    );
    expect(r.rows[0].n).toBe(13);
  });

  it("classes.name is unique", async () => {
    await expectReject(() => pg.query("insert into classes (name) values ('Pro')"));
  });

  it("registrations are unique per (race, user)", async () => {
    await pg.query("insert into registrations (race_id, user_id) values ($1, $2)", [
      ids.race,
      ids.driver,
    ]);
    await expectReject(() =>
      pg.query("insert into registrations (race_id, user_id) values ($1, $2)", [
        ids.race,
        ids.driver,
      ]),
    );
  });

  it("exactly one judge per criterion, but many battle judges", async () => {
    await pg.query("insert into race_officials (race_id, user_id, duty) values ($1, $2, 'line')", [
      ids.race,
      ids.judgeA,
    ]);
    // Second 'line' judge for the same race → rejected.
    await expectReject(() =>
      pg.query("insert into race_officials (race_id, user_id, duty) values ($1, $2, 'line')", [
        ids.race,
        ids.judgeB,
      ]),
    );
    // Two different battle judges for the same race → both allowed.
    await pg.query("insert into race_officials (race_id, user_id, duty) values ($1, $2, 'battle')", [
      ids.race,
      ids.judgeA,
    ]);
    await pg.query("insert into race_officials (race_id, user_id, duty) values ($1, $2, 'battle')", [
      ids.race,
      ids.judgeB,
    ]);
    const r = await pg.query<{ n: number }>(
      "select count(*)::int as n from race_officials where race_id = $1 and duty = 'battle'",
      [ids.race],
    );
    expect(r.rows[0].n).toBe(2);
  });

  it("a class referenced by a race cannot be deleted (ON DELETE restrict)", async () => {
    await expectReject(() => pg.query("delete from classes where id = $1", [ids.class]));
  });

  it("deleting an event cascades to its races (no results guard is app-level)", async () => {
    const ev = await pg.query<{ id: string }>(
      "insert into events (name, start_date, end_date) values ('Temp', '2026-08-01', '2026-08-02') returning id",
    );
    await pg.query("insert into races (event_id, name, class_id, cup_size) values ($1, 'R', $2, '4')", [
      ev.rows[0].id,
      ids.class,
    ]);
    await pg.query("delete from events where id = $1", [ev.rows[0].id]);
    const r = await pg.query<{ n: number }>(
      "select count(*)::int as n from races where event_id = $1",
      [ev.rows[0].id],
    );
    expect(r.rows[0].n).toBe(0);
  });
});
