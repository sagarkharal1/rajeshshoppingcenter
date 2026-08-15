/*
 * Creates the release signing key, once.
 *
 * Android identifies an app by its signing key, not its name. An update only
 * installs over an existing app when both are signed by the same key, so if
 * this file is lost every customer has to uninstall and reinstall — losing
 * whatever the app kept on their phone — before they can take another update.
 *
 * Refuses to overwrite an existing keystore for that reason.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const androidRoot = resolve(here, "..");
const keystore = join(androidRoot, "rajesh-release.keystore");
const propsFile = join(androidRoot, "keystore.properties");

if (existsSync(keystore)) {
  console.error(
    `\nA keystore already exists:\n  ${keystore}\n\n` +
      `Refusing to replace it. If it were replaced, no update could ever install\n` +
      `over an APK signed with the old one. Delete it by hand only if you are\n` +
      `certain nothing signed with it has been given to anyone.\n`,
  );
  process.exit(1);
}

// Base64 of 24 random bytes: no shell-quoting hazards, ~192 bits of entropy.
const password = randomBytes(24).toString("base64url");
const alias = "rajesh";

// Resolved explicitly rather than left to the shell: the repo path contains a
// space, and running through cmd.exe splits the keystore path at it.
function findKeytool() {
  if (process.env.JAVA_HOME) {
    const candidate = join(process.env.JAVA_HOME, "bin", "keytool.exe");
    if (existsSync(candidate)) return candidate;
    const posix = join(process.env.JAVA_HOME, "bin", "keytool");
    if (existsSync(posix)) return posix;
  }

  const probe = spawnSync(process.platform === "win32" ? "where" : "which", ["keytool"], {
    encoding: "utf8",
  });

  const found = probe.stdout?.split(/\r?\n/).find((line) => line.trim());
  if (found) return found.trim();

  console.error("\nCould not find keytool. Set JAVA_HOME or put it on PATH.\n");
  process.exit(1);
}

const result = spawnSync(
  findKeytool(),
  [
    "-genkeypair",
    "-v",
    "-keystore", keystore,
    "-alias", alias,
    "-keyalg", "RSA",
    "-keysize", "4096",
    // 10000 days. Google requires a validity beyond 2033 for Play; this app is
    // sideloaded, but an expired key is just as fatal here, so give it room.
    "-validity", "10000",
    "-storepass", password,
    "-keypass", password,
    "-dname", "CN=Rajesh Shopping Center, OU=Retail, O=Rajesh Shopping Center, L=Gulmi, ST=Lumbini, C=NP",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

if (result.status !== 0) {
  console.error(result.stderr?.toString() || "keytool failed");
  process.exit(1);
}

await writeFile(
  propsFile,
  [
    "# Read by android/app/build.gradle when building a release APK.",
    "# Git-ignored on purpose. This file and the .keystore beside it are the",
    "# only things that can sign an update for an already-installed app.",
    "",
    `storeFile=${keystore.replace(/\\/g, "/")}`,
    `storePassword=${password}`,
    `keyAlias=${alias}`,
    `keyPassword=${password}`,
    "",
  ].join("\n"),
  "utf8",
);

console.log(`Keystore   ${keystore}`);
console.log(`Properties ${propsFile}`);
console.log(`Alias      ${alias}`);
console.log("");
console.log("Back up BOTH files somewhere off this machine before you share an APK.");
console.log("Without them, no future update can install over what customers have.");
