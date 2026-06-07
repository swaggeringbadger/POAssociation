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

// DB pool tunables are env-overridable so prod can be re-tuned from the App
// Service "Environment variables" blade WITHOUT a code change/redeploy — set the
// var, restart, done. Each falls back to a sane default when unset/invalid.
const poolNum = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: resolveSsl(),
  // Per-instance connection cap. POA's long AI-analysis requests can hold a
  // connection for minutes while awaiting Gemini/Anthropic, so a 10-slot pool
  // starves under only a handful of concurrent analyses. Generously sized
  // against the shared Flex (max_connections=859). Override: DB_POOL_MAX.
  max: poolNum(process.env.DB_POOL_MAX, 25),
  // TCP keepalive. The Azure Flex sits behind a VNet + NAT gateway that reaps
  // idle TCP connections after ~4 min. A long AI-analysis request goes TCP-quiet
  // while awaiting the model API; without probes the NAT kills the socket and
  // the write-back fails ("Connection terminated unexpectedly"). keepAlive alone
  // is NOT enough — Linux defaults the first probe to ~2h, so we MUST set an
  // explicit initial delay to start probing before the reap window.
  // Override: DB_KEEPALIVE_INITIAL_DELAY_MS.
  keepAlive: true,
  keepAliveInitialDelayMillis: poolNum(process.env.DB_KEEPALIVE_INITIAL_DELAY_MS, 10_000),
  // Retire idle pooled connections below the NAT reap so WE close them cleanly.
  // Override: DB_IDLE_TIMEOUT_MS.
  idleTimeoutMillis: poolNum(process.env.DB_IDLE_TIMEOUT_MS, 30_000),
  // Fail a hung connect fast instead of waiting forever. Override: DB_CONNECTION_TIMEOUT_MS.
  connectionTimeoutMillis: poolNum(process.env.DB_CONNECTION_TIMEOUT_MS, 10_000),
});

// An always-on Flex can drop idle connections; an idle-client error must not
// crash the process. node-postgres re-establishes connections on next use.
pool.on("error", (err) => {
  console.error("[db] unexpected idle client error (non-fatal):", err.message);
});

export const db = drizzle(pool, { schema });
