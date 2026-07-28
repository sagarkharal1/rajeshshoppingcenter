import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { logger } from "./logger";

// No hardcoded fallback: if ADMIN_JWT_SECRET is missing we generate a random
// secret at boot. Auth still works, but every restart logs all admins out —
// a loud, safe failure instead of a forgeable public secret.
const envSecret = process.env.ADMIN_JWT_SECRET;
if (!envSecret) {
  logger.error(
    "ADMIN_JWT_SECRET is not set. Using a random one-time secret: admin logins " +
      "will reset on every server restart until you set ADMIN_JWT_SECRET.",
  );
}
export const JWT_SECRET: string = envSecret || randomBytes(48).toString("hex");

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    jwt.verify(auth.slice(7), JWT_SECRET, { algorithms: ["HS256"] });
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
