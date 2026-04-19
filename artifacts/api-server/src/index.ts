import app from "./app";
import { logger } from "./lib/logger";
import { ensureBootstrapData } from "./lib/bootstrap";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!process.env.ADMIN_JWT_SECRET) {
  logger.warn(
    "ADMIN_JWT_SECRET environment variable is not set. " +
    "Using a default fallback secret is insecure in production. " +
    "Set a strong random secret in your environment variables.",
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
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to bootstrap default database data");
    process.exit(1);
  });
