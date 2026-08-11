import rateLimit, { type Store, type ClientRateLimitInfo } from "express-rate-limit";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Rate limiting that survives running on more than one instance.
 *
 * The library's default store keeps its counts in the memory of one process.
 * This app runs on several, and requests land on whichever is free — so a
 * limit of twenty was really twenty *per instance*, and whether a request was
 * refused came down to which one answered. Measured against the live site the
 * remaining count jumped 4, 8, 8, 7, 3, 7, 6, 0, 2, 1: separate tallies, none
 * of them the whole picture.
 *
 * Counting in Postgres gives every instance the same tally. The volume is
 * tiny — a handful of rows per window — and the table is self-cleaning.
 */

const WINDOW_TABLE = "rate_limit_counters";

let ensured: Promise<void> | null = null;
function ensureTable() {
  if (!ensured) {
    ensured = db
      .execute(
        sql`CREATE TABLE IF NOT EXISTS rate_limit_counters (
              bucket_key text NOT NULL,
              window_start timestamptz NOT NULL,
              hits integer NOT NULL DEFAULT 0,
              PRIMARY KEY (bucket_key, window_start)
            )`,
      )
      .then(() => undefined)
      .catch((error) => {
        // A limiter that cannot reach the database must not take the shop down
        // with it; it falls back to allowing the request, which is what the
        // memory store did anyway.
        console.error("Could not create the rate limit table:", error);
        ensured = null;
      });
  }
  return ensured;
}

class PostgresStore implements Store {
  private windowMs = 60_000;

  init(options: { windowMs: number }) {
    this.windowMs = options.windowMs;
  }

  private windowStart(now = Date.now()) {
    return new Date(Math.floor(now / this.windowMs) * this.windowMs);
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const start = this.windowStart();
    const resetTime = new Date(start.getTime() + this.windowMs);
    try {
      await ensureTable();
      const result: any = await db.execute(
        sql`INSERT INTO rate_limit_counters (bucket_key, window_start, hits)
            VALUES (${key}, ${start.toISOString()}, 1)
            ON CONFLICT (bucket_key, window_start)
            DO UPDATE SET hits = rate_limit_counters.hits + 1
            RETURNING hits`,
      );
      const rows = result?.rows ?? result ?? [];
      const totalHits = Number(rows[0]?.hits ?? 1);

      // Old windows are worthless once passed. Clearing them occasionally
      // keeps the table from growing without needing a scheduled job.
      if (Math.random() < 0.01) {
        await db
          .execute(sql`DELETE FROM rate_limit_counters WHERE window_start < now() - interval '1 day'`)
          .catch(() => undefined);
      }

      return { totalHits, resetTime };
    } catch (error) {
      console.error("Rate limit counter failed, allowing the request:", error);
      return { totalHits: 1, resetTime };
    }
  }

  async decrement(key: string) {
    const start = this.windowStart();
    await db
      .execute(
        sql`UPDATE rate_limit_counters SET hits = GREATEST(hits - 1, 0)
            WHERE bucket_key = ${key} AND window_start = ${start.toISOString()}`,
      )
      .catch(() => undefined);
  }

  async resetKey(key: string) {
    await db
      .execute(sql`DELETE FROM rate_limit_counters WHERE bucket_key = ${key}`)
      .catch(() => undefined);
  }
}

/**
 * For the two lookups a customer can use without logging in: tracking an order,
 * and opening their own khata.
 *
 * Both take a guessable identifier — order ids count upwards and customer codes
 * run CUST-00001, CUST-00002 — checked against a phone number. One at a time
 * that is a fair way for a customer to reach their own record. Hundreds at a
 * time it walks the shop's history.
 */
export const customerLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  store: new PostgresStore(),
  message: {
    error: "Too many lookups from this device. Please wait a few minutes and try again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Guessing the owner's password, counted across every instance. */
export const ownerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  store: new PostgresStore(),
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

export { WINDOW_TABLE };
