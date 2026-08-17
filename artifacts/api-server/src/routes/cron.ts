import { Router } from "express";
import { runScheduledBackup } from "../lib/scheduled-backup.js";
import { processTelegramQueueOnce } from "../utils/telegram-service.js";
import { logger } from "../lib/logger.js";

const router = Router();

/**
 * The scheduled work that a long-running server used to do in the background.
 *
 * `api-server/src/index.ts` starts two workers at boot — a 30-second Telegram
 * queue drain and a 24-hour backup. Serverless has no process to hold either,
 * so Vercel Cron calls this route instead.
 *
 * Vercel Hobby allows **one cron per day**, fired anywhere within the hour, so
 * both jobs share this one endpoint. That cap is also why login codes are sent
 * synchronously (`sendTelegramMessageNow`) rather than queued: a code drained
 * up to 24 hours later is a lock-out, not a delay.
 *
 * The daily hit doubles as a keep-alive — a free Supabase project pauses after
 * seven days without an API request.
 */
router.get("/cron/daily", async (req, res) => {
  // Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
  // Without the check this is a public endpoint that anyone could use to make
  // the shop take backups continuously.
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    logger.error("CRON_SECRET is not set — refusing to run scheduled work.");
    return res.status(503).json({
      error: "CRON_SECRET is not configured on the server.",
    });
  }

  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Each job is reported separately and neither can prevent the other from
  // running. A backup failure must not also stop the queue from draining.
  const results: Record<string, unknown> = {};

  try {
    results.telegram = await processTelegramQueueOnce();
  } catch (error) {
    logger.error({ err: error }, "Cron: draining the Telegram queue failed");
    results.telegram = { error: "failed" };
  }

  try {
    results.backup = await runScheduledBackup("schedule");
  } catch (error) {
    logger.error({ err: error }, "Cron: scheduled backup failed");
    results.backup = { error: "failed" };
  }

  res.json({ ranAt: new Date().toISOString(), ...results });
});

export default router;
