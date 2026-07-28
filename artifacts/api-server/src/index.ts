import app from "./app";
import { logger } from "./lib/logger";
import { ensureBootstrapData } from "./lib/bootstrap";
import { startScheduledBackups } from "./lib/scheduled-backup.js";
import { startTelegramQueueWorker } from "./utils/telegram-service.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!process.env.ADMIN_JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "ADMIN_JWT_SECRET environment variable is required in production. " +
      "Set a strong random secret (e.g. `openssl rand -hex 32`) before starting the server.",
  );
}

void ensureBootstrapData()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
      startTelegramQueueWorker();
      startScheduledBackups();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to bootstrap default database data");
    process.exit(1);
  });
