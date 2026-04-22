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

// pg-connection-string v3 now maps sslmode=require → verify-full (rejectUnauthorized: true).
// Strip sslmode from the URL so the parser cannot force rejectUnauthorized: true,
// then pass ssl: { rejectUnauthorized: false } directly so DigitalOcean's
// self-signed CA certificate is accepted.
const connectionString = rawUrl
  .replace(/&sslmode=[^&]*/i, "")   // sslmode is not the first query param
  .replace(/\?sslmode=[^&]*/i, "?") // sslmode is the first query param
  .replace(/\?$/, "");               // remove trailing ? if nothing left

export const pool = new Pool({
  connectionString,
  ssl: rawUrl.toLowerCase().includes("sslmode=")
    ? { rejectUnauthorized: false }
    : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
