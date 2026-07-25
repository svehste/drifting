/** Apply generated migrations to the database. Run: npm run db:migrate */
import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  await migrate(db, { migrationsFolder: "drizzle" });
  await sql.end();
  console.log("✓ Migrations applied.");
}

main().catch((err) => {
  console.error("✗ db:migrate failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
