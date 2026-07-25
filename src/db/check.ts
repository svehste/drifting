/**
 * Verify the DB connection and that the schema's tables exist (M2 DoD).
 * Run: npm run db:check
 */
import "./load-env";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client);

  const [{ now }] = await db.execute<{ now: string }>(sql`select now() as now`);
  const tables = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables
        where table_schema = 'public' order by table_name`,
  );

  await client.end();

  console.log(`✓ Connected. Server time: ${now}`);
  console.log(`✓ ${tables.length} tables:`, tables.map((t) => t.table_name).join(", ") || "(none)");
}

main().catch((err) => {
  console.error("✗ db:check failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
