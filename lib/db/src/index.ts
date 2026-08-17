import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const rawUrl = process.env.DATABASE_URL ?? "";

// Neither DigitalOcean nor Supabase's pooler chains to a CA that Node ships
// with: both present a certificate signed by their own root, so verifying
// against the default bundle fails with SELF_SIGNED_CERT_IN_CHAIN.
//
// There are two honest ways out, and one dishonest one.
//
//   DATABASE_CA_CERT — the provider's own root, in PEM. Verification stays on
//     and now succeeds, because Node finally has the certificate it needs to
//     check against. This is the right answer. Supabase publishes it under
//     Settings → Database → SSL Configuration.
//
//   DATABASE_SSL_NO_VERIFY — encrypt, but believe whatever certificate the
//     other end offers. The traffic is unreadable to an eavesdropper, but
//     nothing proves the other end is really the database. A fallback for
//     getting a deployment moving, not somewhere to stay.
//
// The dishonest one is defaulting to no verification because it always works.
// That is how a connection carrying every invoice and phone number ends up
// open to interception with nobody aware it happened.
const skipSslVerify = process.env.DATABASE_SSL_NO_VERIFY === "true";

// Vercel's environment editor keeps real newlines, but plenty of tools flatten
// a pasted certificate to a single line with literal \n. Accept both rather
// than fail on a difference nobody can see in the input box.
const caCert = process.env.DATABASE_CA_CERT
  ? process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n").trim()
  : "";

// sslmode comes out of the URL unconditionally. It is a second, quieter switch
// on the same thing this file decides explicitly below — pg-connection-string
// reads it and can override the config, and its mapping has changed between
// driver versions. One place decides TLS; it is here.
const connectionString = rawUrl
  .replace(/&sslmode=[^&]*/i, "")   // sslmode is not the first query param
  .replace(/\?sslmode=[^&]*/i, "?") // sslmode is the first query param
  .replace(/\?$/, "");               // remove trailing ? if nothing left

// DATABASE_POOL_MAX caps concurrent connections.
//
// On serverless every instance opens its own pool, and a few hundred cold
// instances will exhaust the database's connection limit between them. Set this
// to 1 on Vercel, and point DATABASE_URL at Supabase's transaction pooler
// (port 6543) rather than the direct connection (5432).
const poolMax = Number(process.env.DATABASE_POOL_MAX);

// A database reached across the internet is always encrypted; only a local one
// is not. This used to key off `sslmode=` appearing in the URL, which meant a
// connection string without it — Supabase's pooler string, for one — connected
// in plain text. Against a managed database that fails outright, and where it
// does not fail it sends every invoice and phone number unencrypted.
const isLocalDatabase = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(rawUrl);

function sslOptions() {
  // A database on this machine is not crossing a network to be intercepted on.
  if (isLocalDatabase) return undefined;
  // Explicitly asked for encryption without proof of identity.
  if (skipSslVerify) return { rejectUnauthorized: false };
  // The provider's root supplied: verify properly, against that.
  if (caCert) return { ca: caCert, rejectUnauthorized: true };
  // Nothing supplied: verify against Node's bundled roots. Hosts that need
  // their own CA fail here rather than quietly connecting unverified, and the
  // error names which of the two variables above is missing.
  return { rejectUnauthorized: true };
}

export const pool = new Pool({
  connectionString,
  ...(Number.isFinite(poolMax) && poolMax > 0 ? { max: poolMax } : {}),
  ssl: sslOptions(),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
