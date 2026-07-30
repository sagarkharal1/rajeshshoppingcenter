/**
 * Two-step login (TOTP) verification.
 *
 * This exists because of a real bug: otplib's verifySync returns a RESULT
 * OBJECT, not a boolean — `{ valid: false }` for a wrong code. The original
 * check did `Boolean(verifySync(...))`, and every object is truthy, so every
 * six-digit code was accepted. Two-step security was decorative: anyone with
 * the password could type any six digits and get in.
 *
 * The danger is that it *looks* like it works — enabling 2FA appeared to
 * succeed, because the setup step accepted the fake code too.
 */
import { generateSecret, generateSync, verifySync } from "otplib";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

// Mirrors verifyTotp() in artifacts/api-server/src/routes/admin.ts
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

function verifyTotp(token, secret) {
  try {
    const result = verifySync({
      token,
      secret,
      epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    });
    return result?.valid === true;
  } catch {
    return false;
  }
}

const secret = generateSecret();
const realCode = generateSync({ secret });

check("the genuine current code is accepted", verifyTotp(realCode, secret) === true, realCode);

// The exact shape of the original bug: a wrong code returns a falsy-valued
// object, which the old code coerced to true.
const wrongResult = verifySync({ token: "000000", secret });
check("a wrong code returns an object, not a boolean",
  typeof wrongResult === "object" && wrongResult !== null,
  JSON.stringify(wrongResult));
check("that object is truthy — why Boolean() was unsafe", Boolean(wrongResult) === true);
check("but its valid flag is false", wrongResult.valid === false);

for (const [token, label] of [
  ["000000", "all zeros"],
  ["123456", "sequential digits"],
  ["999999", "all nines"],
  ["111111", "repeated digits"],
  [String((Number(realCode) + 1) % 1000000).padStart(6, "0"), "genuine code off by one"],
]) {
  check(`rejects ${label}`, verifyTotp(token, secret) === false, token);
}

for (const [token, label] of [
  ["abcdef", "letters"],
  ["", "empty"],
  ["12345", "too short"],
  ["1234567", "too long"],
  ["  ", "whitespace"],
]) {
  check(`rejects malformed input: ${label}`, verifyTotp(token, secret) === false);
}

// A code generated from a different secret must never pass.
const otherSecret = generateSecret();
const otherCode = generateSync({ secret: otherSecret });
check("rejects a valid code from a different secret", verifyTotp(otherCode, secret) === false, otherCode);

// Clock drift and slow typing. Note epoch is in SECONDS here — passing
// milliseconds silently produces codes for a completely different time.
const nowSec = Math.floor(Date.now() / 1000);
const codeAt = (offsetSeconds) => generateSync({ secret, epoch: nowSec + offsetSeconds });

check("accepts the code from the previous 30s step (typed a little too slowly)",
  verifyTotp(codeAt(-30), secret) === true);
check("accepts the code from the next 30s step (phone clock slightly ahead)",
  verifyTotp(codeAt(30), secret) === true);
check("rejects a code from two steps back (60s)", verifyTotp(codeAt(-60), secret) === false);
check("rejects a code from two steps ahead (60s)", verifyTotp(codeAt(60), secret) === false);
check("rejects a code from five minutes away", verifyTotp(codeAt(300), secret) === false);

const failed = results.filter((r) => !r.pass);
console.log(`\n${"=".repeat(64)}`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) console.log(`  - ${f.name}`);
}
process.exit(failed.length ? 1 : 0);
