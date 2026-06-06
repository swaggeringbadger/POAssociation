import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

/**
 * Database connection (node-postgres / standard Postgres TCP).
 *
 * Replaces the former Neon serverless (WebSocket) driver: the Azure Flex
 * Postgres target speaks standard TCP and the Neon driver cannot connect to
 * it. node-postgres works against both Neon (current) and the Azure Flex
 * (after cutover). See persistent-memory/poa-azure-migration-handbook.md.
 */

// Neon (today) and Azure Flex (after cutover) both require TLS. Only opt out
// if the connection string explicitly asks for it (e.g. a local plaintext DB).
function resolveSsl(): false | { rejectUnauthorized: boolean } {
  const url = process.env.DATABASE_URL ?? "";
  if (/sslmode=disable/i.test(url)) return false;
  // rejectUnauthorized:false accepts the provider CA chain without local trust
  // config — matches the Hazel's Style / SB Azure pattern.
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
  ssl: resolveSsl(),
  keepAlive: true,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// An always-on Flex can drop idle connections; an idle-client error must not
// crash the process. node-postgres re-establishes connections on next use.
pool.on("error", (err) => {
  console.error("[db] unexpected idle client error (non-fatal):", err.message);
});

export const db = drizzle(pool, { schema });
