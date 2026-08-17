import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

/**
 * The real error, not the wrapper around it.
 *
 * Drizzle reports a failed query as "Failed query: select 1" and keeps the
 * driver's actual complaint — wrong password, unreachable host, rejected
 * certificate — in `cause`. Reporting the outer message says only that a
 * query failed, which was never in doubt.
 */
function describe(error: unknown) {
  let root: any = error;
  const chain: string[] = [];

  while (root) {
    if (root?.message) chain.push(String(root.message).split("\n")[0]);
    if (!root.cause) break;
    root = root.cause;
  }

  return {
    reason: root?.message ? String(root.message) : String(root),
    code: root?.code ?? null,
    // Everything on the way down, in case the useful part is not the deepest.
    chain,
  };
}

// Certificate failures are the one cause worth naming without the debug key.
// The code says nothing secret — it does not reveal a host, a user or a
// password — and it cost hours to identify from "Failed query: select 1". The
// next person to see this deserves the answer in the response, not a hunt.
const TLS_CODES = new Set([
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
]);

function hintFor(error: unknown): string {
  let root: any = error;
  while (root?.cause) root = root.cause;

  if (TLS_CODES.has(root?.code)) {
    return (
      "The database's certificate could not be verified. Supabase and " +
      "DigitalOcean sign with their own root, which Node does not ship. Put " +
      "that root in DATABASE_CA_CERT (Supabase: Settings → Database → SSL " +
      "Configuration), or set DATABASE_SSL_NO_VERIFY=true to connect " +
      "encrypted but unverified."
    );
  }

  return "The site is running but cannot reach its database. Check DATABASE_URL.";
}

/**
 * Is the service alive, and can it reach its database?
 *
 * This used to answer `{status:"ok"}` without touching anything, and sat
 * behind the same startup gate as every other route — so when the database
 * was unreachable the health check returned 503 "Service is starting" like
 * everything else. The one endpoint whose job is to report what is wrong was
 * the one that could not.
 *
 * It now answers even when startup has failed, and says which half is broken.
 * The reason stays out of the response: this is public, and "password
 * authentication failed" tells a stranger more than it tells the owner. The
 * detail goes to the log, which is where someone debugging is already looking.
 */
router.get("/healthz", async (req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: "ok", database: "ok" });
  } catch (error) {
    console.error("Health check: database unreachable", error);

    // The reason is withheld by default — "password authentication failed"
    // tells a stranger more than it tells the owner. Someone holding
    // CRON_SECRET is already trusted with the scheduled job, so they can ask
    // for it: /api/healthz?debug=<CRON_SECRET>. Without this the only place
    // the message exists is the hosting provider's log viewer, which is a
    // miserable place to be when the shop is down.
    const secret = process.env.CRON_SECRET;
    const asked = typeof req.query.debug === "string" ? req.query.debug : "";
    const trusted = Boolean(secret) && asked === secret;

    // 200, not 503: the web service answered. Saying otherwise makes an
    // unreachable database look like a dead site.
    res.status(200).json({
      status: "degraded",
      database: "unreachable",
      hint: hintFor(error),
      ...(trusted ? describe(error) : {}),
    });
  }
});

export default router;
