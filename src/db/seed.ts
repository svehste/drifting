/**
 * Local dev seed: a default class list and one admin user. Idempotent — safe to
 * re-run. Run: npm run db:seed
 *
 * Note: the admin's login password lives in Supabase Auth (set via the invite
 * flow in M3). This seed only creates the app-side user + role rows so there is
 * an admin to attach that auth identity to.
 */
import "./load-env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { classes, userRoles, users } from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";

const sql = postgres(url, { max: 1 });
const db = drizzle(sql, { schema: { classes, userRoles, users } });

const defaultClasses = [
  { name: "Pro", sortOrder: 1 },
  { name: "Semi-Pro", sortOrder: 2 },
];

await db.insert(classes).values(defaultClasses).onConflictDoNothing({ target: classes.name });

await db
  .insert(users)
  .values({ firstName: "Arrangement", lastName: "Admin", email: ADMIN_EMAIL, status: "active" })
  .onConflictDoNothing({ target: users.email });

const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.email, ADMIN_EMAIL));
if (admin) {
  await db.insert(userRoles).values({ userId: admin.id, role: "admin" }).onConflictDoNothing();
}

await sql.end();
console.log(`✓ Seeded ${defaultClasses.length} classes and admin <${ADMIN_EMAIL}>.`);
