#!/usr/bin/env node
/**
 * Break-glass owner recovery.
 *
 * For the case where every normal route is gone at once: the authenticator
 * phone is lost, the setup key was not written down, and Telegram is not
 * delivering the reset code. It talks straight to the database, so the only
 * thing it needs is DATABASE_URL — which only the owner has.
 *
 *   # See what state the login is in (changes nothing)
 *   DATABASE_URL="postgres://..." node scripts/recover-admin.mjs --status
 *
 *   # Turn off two-step login so you can get in with the password alone
 *   DATABASE_URL="postgres://..." node scripts/recover-admin.mjs --disable-2fa
 *
 *   # Set a new password (also clears any half-finished 2FA setup)
 *   DATABASE_URL="postgres://..." node scripts/recover-admin.mjs --set-password "new-password"
 *
 * Get DATABASE_URL from DigitalOcean: your app -> Settings -> the api
 * component -> Environment Variables -> DATABASE_URL (click to reveal).
 *
 * After recovering: log in, change the password from inside the app, and set
 * up Google Authenticator again — writing the key down this time.
 */
import pg from "pg";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Must match hashPassword() in artifacts/api-server/src/routes/admin.ts —
// salt and derived key, hex, separated by a colon.
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1] ?? null;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required.\n\nRun with:\n  DATABASE_URL=\"postgres://...\" node scripts/recover-admin.mjs --status");
  process.exit(1);
}

const wantStatus = has("--status");
const wantDisable2fa = has("--disable-2fa");
const newPassword = valueOf("--set-password");

if (!wantStatus && !wantDisable2fa && newPassword === null) {
  console.error("Choose one:\n  --status\n  --disable-2fa\n  --set-password \"new-password\"");
  process.exit(1);
}
if (newPassword !== null && newPassword.length < 6) {
  console.error("The new password must be at least 6 characters.");
  process.exit(1);
}

// The app strips sslmode and disables cert verification for DigitalOcean's
// self-signed CA; mirror that so this connects the same way the app does.
const cleaned = connectionString
  .replace(/&sslmode=[^&]*/i, "")
  .replace(/\?sslmode=[^&]*/i, "?")
  .replace(/\?$/, "");

const client = new pg.Client({
  connectionString: cleaned,
  ssl: /sslmode=/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();

  const { rows } = await client.query(
    `SELECT id, shop_name, admin_username,
            admin_password_hash IS NOT NULL AS has_password,
            totp_secret IS NOT NULL        AS totp_on,
            totp_pending_secret IS NOT NULL AS totp_half_setup
     FROM settings ORDER BY id LIMIT 1`,
  );

  if (rows.length === 0) {
    console.error("No settings row found — is DATABASE_URL pointing at the right database?");
    process.exit(1);
  }

  const s = rows[0];
  console.log(`Shop            : ${s.shop_name}`);
  console.log(`Owner username  : ${s.admin_username || "owner"}`);
  console.log(`Custom password : ${s.has_password ? "set" : "not set (default password still in use)"}`);
  console.log(`Two-step login  : ${s.totp_on ? "ON" : "off"}${s.totp_half_setup ? " (a half-finished setup is pending)" : ""}`);

  if (wantStatus) {
    console.log("\nNothing was changed.");
    process.exit(0);
  }

  const sets = [];
  const params = [];
  if (wantDisable2fa || newPassword !== null) {
    sets.push("totp_secret = NULL", "totp_pending_secret = NULL");
  }
  if (newPassword !== null) {
    params.push(await hashPassword(newPassword));
    sets.push(`admin_password_hash = $${params.length}`);
  }
  // Clear any outstanding reset code so an old one cannot be replayed.
  sets.push("admin_otp = NULL", "admin_otp_expiry = NULL");

  params.push(s.id);
  await client.query(`UPDATE settings SET ${sets.join(", ")} WHERE id = $${params.length}`, params);

  console.log("");
  if (wantDisable2fa) console.log("✓ Two-step login turned off.");
  if (newPassword !== null) console.log("✓ Password changed.");
  console.log("✓ Any pending reset code cleared.");
  console.log(`\nLog in as "${s.admin_username || "owner"}"${newPassword !== null ? " with the new password" : ""}, then set up Google Authenticator again and write the key down.`);
} catch (error) {
  console.error(`\nFailed: ${error.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
