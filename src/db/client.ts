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
  // pgbouncer (Supabase transaction pooler, port 6543): no prepared statements.
  //
  // Keep the per-instance pool small. Each serverless instance holds its pool's
  // sockets open and the pooler pins one server backend per open socket; Vercel
  // freezes/kills instances between (or mid-) invocations, so those sockets — and
  // their pooler slots — linger. A large `max` lets a few instances exhaust the
  // pooler, after which queries queue until the statement timeout fires (→ 500s).
  //   - max: 3          → bound the slots one instance can pin (no page needs
  //                       more than this; the hot admin pages read sequentially)
  //   - idle_timeout    → drop sockets when the instance goes quiet
  //   - max_lifetime    → recycle so stale/half-dead sockets don't linger
  //   - connect_timeout → surface pooler exhaustion fast instead of hanging
  //   - idle_in_transaction_session_timeout → Postgres reaps a transaction left
  //     open by an instance frozen between BEGIN and COMMIT (e.g. registerDriver),
  //     releasing its locks and pooler slot instead of leaking them.
  //
  // NOTE: never pipeline many queries onto one connection here — postgres.js does
  // that when the pool has fewer free connections than concurrent queries, and
  // over the transaction pooler a wide pipeline stalls until the statement
  // timeout. Keep page reads sequential (or ≤ a couple in parallel).
  const client =
    globalForDb._pg ??
    postgres(connectionString, {
      prepare: false,
      max: 3,
      idle_timeout: 20,
      max_lifetime: 60 * 5,
      connect_timeout: 10,
      connection: { idle_in_transaction_session_timeout: 30000 },
    });
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
