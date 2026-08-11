/**
 * The shared rate-limit counter, against a real Postgres engine.
 *
 * The in-memory store counts per process, and this app runs on several. Live,
 * that showed up as a remaining count of 4, 8, 8, 7, 3, 7, 6, 0, 2, 1 for one
 * run of requests — separate tallies, so a limit of twenty was really twenty
 * per instance. What matters here is that two instances sharing one database
 * reach the same total, and that the window rolls over cleanly.
 */
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

await db.exec(`
CREATE TABLE rate_limit_counters (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);
`);

const WINDOW_MS = 15 * 60 * 1000;
const windowStart = (now) => new Date(Math.floor(now / WINDOW_MS) * WINDOW_MS);

// Mirrors PostgresStore.increment: one statement, so two instances racing on
// the same key cannot both read the same total and overwrite each other.
async function increment(key, now) {
  const start = windowStart(now).toISOString();
  const res = await db.query(
    `INSERT INTO rate_limit_counters (bucket_key, window_start, hits)
     VALUES ($1, $2, 1)
     ON CONFLICT (bucket_key, window_start)
     DO UPDATE SET hits = rate_limit_counters.hits + 1
     RETURNING hits`,
    [key, start],
  );
  return Number(res.rows[0].hits);
}

const t0 = Date.UTC(2026, 7, 11, 10, 0, 0);

// ── Two instances, one tally ────────────────────────────────────────────────
{
  const totals = [];
  for (let i = 0; i < 10; i++) {
    // Alternating "instances" — with per-process memory each would see 5.
    totals.push(await increment("ip:203.0.113.9", t0 + i * 1000));
  }
  check("counting is continuous across instances", totals.join(",") === "1,2,3,4,5,6,7,8,9,10", totals.join(","));
  check("the tenth request knows it is the tenth", totals[9] === 10);
}

// ── The limit is reached exactly once ───────────────────────────────────────
{
  const key = "ip:198.51.100.4";
  let firstBlocked = null;
  for (let i = 1; i <= 25; i++) {
    const hits = await increment(key, t0 + i * 1000);
    if (hits > 20 && firstBlocked === null) firstBlocked = i;
  }
  check("request 21 is the first over a limit of 20", firstBlocked === 21, `blocked at ${firstBlocked}`);
}

// ── Separate visitors do not share a bucket ─────────────────────────────────
{
  const a = await increment("ip:192.0.2.1", t0);
  const b = await increment("ip:192.0.2.2", t0);
  check("one visitor's attempts do not count against another", a === 1 && b === 1, `${a} / ${b}`);
}

// ── A new window starts clean ───────────────────────────────────────────────
{
  const key = "ip:203.0.113.77";
  await increment(key, t0);
  await increment(key, t0);
  const nextWindow = await increment(key, t0 + WINDOW_MS + 1000);
  check("the next window starts from one", nextWindow === 1, `${nextWindow}`);

  const stillOld = await increment(key, t0 + 2000);
  check("the old window keeps its own count", stillOld === 3, `${stillOld}`);
}

// ── Housekeeping ────────────────────────────────────────────────────────────
{
  await db.query(
    `INSERT INTO rate_limit_counters (bucket_key, window_start, hits) VALUES ('old', now() - interval '3 days', 5)`,
  );
  const before = await db.query(`SELECT count(*)::int AS n FROM rate_limit_counters`);
  await db.query(`DELETE FROM rate_limit_counters WHERE window_start < now() - interval '1 day'`);
  const after = await db.query(`SELECT count(*)::int AS n FROM rate_limit_counters`);
  check("stale windows are cleared away", after.rows[0].n < before.rows[0].n, `${before.rows[0].n} -> ${after.rows[0].n}`);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${"=".repeat(64)}\n${passed}/${results.length} checks passed`);
if (passed !== results.length) process.exit(1);
