import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const rawUrl = process.env.DATABASE_URL ?? "";

// DigitalOcean served a self-signed CA, which meant the certificate could not be
// verified and `rejectUnauthorized: false` was the only way to connect. Set
// DATABASE_SSL_NO_VERIFY=true to get that behaviour back for a host that needs
// it. Supabase presents a normally trusted certificate, so the default now
// verifies — turning verification off silently is how a connection ends up
// open to interception without anyone noticing.
const skipSslVerify = process.env.DATABASE_SSL_NO_VERIFY === "true";

// pg-connection-string maps sslmode=require → verify-full. When verification is
// deliberately off, sslmode has to come out of the URL or the parser forces it
// back on.
const connectionString = skipSslVerify
  ? rawUrl
      .replace(/&sslmode=[^&]*/i, "")   // sslmode is not the first query param
      .replace(/\?sslmode=[^&]*/i, "?") // sslmode is the first query param
      .replace(/\?$/, "")                // remove trailing ? if nothing left
  : rawUrl;

// DATABASE_POOL_MAX caps concurrent connections.
//
// On serverless every instance opens its own pool, and a few hundred cold
// instances will exhaust the database's connection limit between them. Set this
// to 1 on Vercel, and point DATABASE_URL at Supabase's transaction pooler
// (port 6543) rather than the direct connection (5432).
const poolMax = Number(process.env.DATABASE_POOL_MAX);

export const pool = new Pool({
  connectionString,
  ...(Number.isFinite(poolMax) && poolMax > 0 ? { max: poolMax } : {}),
  ssl: skipSslVerify
    ? { rejectUnauthorized: false }
    : rawUrl.toLowerCase().includes("sslmode=")
      ? { rejectUnauthorized: true }
      : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
