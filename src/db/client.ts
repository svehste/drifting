/**
 * Server-only Drizzle client. The browser NEVER imports this — all DB access is
 * server-side (tech_stack: no RLS needed, secrets stay server-side).
 *
 * The connection is created lazily on first query so that importing this module
 * (e.g. during `next build` page-data collection) does not require DATABASE_URL.
 */
import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  _pg?: ReturnType<typeof postgres>;
  _db?: Db;
};

function init(): Db {
  if (globalForDb._db) return globalForDb._db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — the server cannot reach the database.");
  }
  // pgbouncer (Supabase pooler): no prepared statements. Cap the per-instance
  // pool and reap idle connections so warm serverless instances don't exhaust
  // the pooler's client limit.
  const client =
    globalForDb._pg ?? postgres(connectionString, { prepare: false, max: 5, idle_timeout: 20 });
  const instance = drizzle(client, { schema });
  // Memoise the client for the life of the (serverless or dev) process. This is
  // essential in production: without it every `db` access would open a fresh
  // pool and quickly exhaust the pooler ("max client connections reached").
  globalForDb._pg = client;
  globalForDb._db = instance;
  return instance;
}

/** Lazily-connected Drizzle instance. Connects on first property access. */
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = init();
    return Reflect.get(instance, prop, instance);
  },
});

export { schema };
