import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

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
router.get("/healthz", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: "ok", database: "ok" });
  } catch (error) {
    // 200, not 503: the web service answered. Saying otherwise makes an
    // unreachable database look like a dead site.
    res.status(200).json({
      status: "degraded",
      database: "unreachable",
      hint: "The site is running but cannot reach its database. Check DATABASE_URL and the server logs.",
    });
    console.error("Health check: database unreachable", error);
  }
});

export default router;
