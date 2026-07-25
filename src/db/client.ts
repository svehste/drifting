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
  const client = globalForDb._pg ?? postgres(connectionString, { prepare: false });
  const instance = drizzle(client, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb._pg = client;
    globalForDb._db = instance;
  }
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
