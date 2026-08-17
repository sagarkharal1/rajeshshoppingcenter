import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// The URL alone left drizzle-kit connecting in plain text, because
// node-postgres only negotiates TLS when told to. It worked, which was the
// problem: a schema push sent the whole structure of the database across the
// internet unencrypted, and turning on "Enforce SSL" in Supabase would have
// broken pushes with an error naming neither SSL nor this file.
//
// The same two variables as the server (lib/db/src/index.ts). DATABASE_CA_CERT
// may hold the certificate itself or a path to it — a push is usually run by
// hand, next to the downloaded .crt.
const rawCert = process.env.DATABASE_CA_CERT?.trim();
const ca = rawCert?.includes("BEGIN CERTIFICATE")
  ? rawCert.replace(/\\n/g, "\n")
  : rawCert
    ? readFileSync(rawCert, "utf8")
    : undefined;

const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(process.env.DATABASE_URL);

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: isLocal
      ? false
      : process.env.DATABASE_SSL_NO_VERIFY === "true"
        ? { rejectUnauthorized: false }
        : ca
          ? { ca, rejectUnauthorized: true }
          : { rejectUnauthorized: true },
  },
});
