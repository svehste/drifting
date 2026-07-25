/**
 * Server-only Drizzle client. The browser NEVER imports this — all DB access is
 * server-side (tech_stack: no RLS needed, secrets stay server-side).
 */
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — the server cannot reach the database.");
}

// One pooled client per server process. Reuse across hot reloads in dev.
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };
const client = globalForDb._pg ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb._pg = client;

export const db = drizzle(client, { schema });
export { schema };
