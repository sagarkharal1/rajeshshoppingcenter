import rateLimit, { MemoryStore, type Store, type ClientRateLimitInfo } from "express-rate-limit";
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

class PostgresStore implements Store {
  private windowMs = 60_000;
  // If the shared count is unavailable for any reason, counting falls back to
  // this process's own memory rather than waving the request through. Worst
  // case that is the old per-instance behaviour; the previous version returned
  // "first request of the window" on failure, which is no limit at all — and
  // it reported a healthy "19 remaining" while doing it.
  private readonly fallback = new MemoryStore();
  private fallbackReady = false;

  init(options: { windowMs: number }) {
    this.windowMs = options.windowMs;
    this.fallback.init(options as any);
    this.fallbackReady = true;
  }

  private windowStart(now = Date.now()) {
    return new Date(Math.floor(now / this.windowMs) * this.windowMs);
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const start = this.windowStart();
    const resetTime = new Date(start.getTime() + this.windowMs);
    try {
      const result: any = await db.execute(
        sql`INSERT INTO rate_limit_counters (bucket_key, window_start, hits)
            VALUES (${key}, ${start.toISOString()}, 1)
            ON CONFLICT (bucket_key, window_start)
            DO UPDATE SET hits = rate_limit_counters.hits + 1
            RETURNING hits`,
      );
      const rows = Array.isArray(result) ? result : (result?.rows ?? []);
      const raw = rows[0]?.hits;
      if (raw === undefined || raw === null) {
        throw new Error("rate limit upsert returned no count");
      }
      const totalHits = Number(raw);

      // Old windows are worthless once passed. Clearing them occasionally
      // keeps the table from growing without needing a scheduled job.
      if (Math.random() < 0.01) {
        await db
          .execute(sql`DELETE FROM rate_limit_counters WHERE window_start < now() - interval '1 day'`)
          .catch(() => undefined);
      }

      return { totalHits, resetTime };
    } catch (error) {
      console.error("Shared rate limit counter unavailable, counting in memory instead:", error);
      if (this.fallbackReady) return this.fallback.increment(key);
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

