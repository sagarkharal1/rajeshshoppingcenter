import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { ensureBootstrapData } from "./lib/bootstrap";
import { logger } from "./lib/logger";

/**
 * Entry point for serverless hosting (Vercel).
 *
 * The difference from index.ts is what it deliberately does *not* do:
 *
 * - No `app.listen()`. The platform owns the socket.
 * - No `startTelegramQueueWorker()` / `startScheduledBackups()`. Both are
 *   `setInterval`/`setTimeout` loops that need a process which outlives the
 *   response, and serverless has none. They run from `/api/cron/daily` instead.
 *
 * Anything that relied on those workers has to hold up without them — see
 * `sendTelegramOtpNow()` in utils/telegram-service.ts, which is why login codes
 * are sent and awaited inside the request rather than queued.
 */

// A cold start has no boot phase — the first request *is* the boot. Bootstrap
// creates tables IF NOT EXISTS and seeds defaults only when absent, so it is
// safe to repeat; memoising it just keeps it off the hot path for every
// subsequent request on the same instance.
let bootstrap: Promise<void> | null = null;

function bootstrapOnce(): Promise<void> {
  if (!bootstrap) {
    bootstrap = ensureBootstrapData().catch((error: unknown) => {
      // Drop the rejected promise so the next request retries. Without this,
      // one failed cold start would serve every later request off the same
      // permanent rejection until the instance is recycled.
      bootstrap = null;
      throw error;
    });
  }

  return bootstrap;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // The health check has to answer when the rest cannot — that is the whole
  // point of it. Behind this gate it returned "Service is starting" like
  // everything else, so the one endpoint able to report a broken database was
  // the one thing that could not be reached to ask.
  const isHealthCheck = (req.url || "").split("?")[0].endsWith("/healthz");

  if (!isHealthCheck) {
    try {
      await bootstrapOnce();
    } catch (error) {
      logger.error({ err: error }, "Bootstrap failed on cold start");
      res.statusCode = 503;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: "Service is starting. Please try again.",
          // Somewhere to look, rather than a message that describes a slow
          // start when the real cause is usually a database it cannot reach.
          hint: "If this persists, open /api/healthz — it reports whether the database is reachable.",
        }),
      );
      return;
    }
  }

  // Express instances are themselves (req, res) handlers.
  (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
