/*
 * Stages the built web app into ./www for Capacitor, and injects the shim that
 * points relative /api paths at the live server.
 *
 * Kept as a copy-then-modify step rather than aiming Capacitor at
 * ../web/dist/public directly, so the web build output is never mutated by an
 * Android build.
 */
import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const androidRoot = resolve(here, "..");
const webDist = resolve(androidRoot, "..", "web", "dist", "public");
const www = join(androidRoot, "www");
const shell = join(androidRoot, "shell");

// Where the packaged app sends every API call, image request and update check.
// Taken from .do/app.yaml, which is the record of what is actually deployed.
const API_ORIGIN = process.env.RAJESH_API_ORIGIN ?? "https://rajeshshoppingcenter.com.np";

const appVersion = JSON.parse(await readFile(join(androidRoot, "app-version.json"), "utf8"));
const APP_VERSION = appVersion.versionName;
const APP_VERSION_CODE = appVersion.versionCode;

if (!existsSync(webDist)) {
  console.error(
    `\nNo web build found at:\n  ${webDist}\n\n` +
      `Build it first:\n  pnpm --filter @workspace/web run build\n`,
  );
  process.exit(1);
}

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });
await cp(webDist, www, { recursive: true });

// The service worker is deliberately not shipped. Assets already live inside
// the APK, so a second cache layer would only serve stale pages after an
// update, and registerPwaServiceWorker() skips localhost anyway.
await rm(join(www, "sw.js"), { force: true });

// The published APK lives under the web app's public folder so the site can
// serve it. Copying it in here would pack the APK inside itself and roughly
// double its size on every build. The install guide is equally pointless to
// someone who has already installed the app.
await rm(join(www, "download"), { recursive: true, force: true });
await rm(join(www, "app"), { recursive: true, force: true });

const shimSource = await readFile(join(shell, "api-origin.js"), "utf8");
const shim = shimSource
  .replace("__API_ORIGIN__", API_ORIGIN)
  .replace("__APP_VERSION__", APP_VERSION)
  .replace("__APP_VERSION_CODE__", String(APP_VERSION_CODE));

await writeFile(join(www, "api-origin.js"), shim, "utf8");
await copyFile(join(shell, "update-check.js"), join(www, "update-check.js"));

// Bundled so the app has a baseline to compare against even before it ever
// reaches the network. The copy that decides whether an update exists is the
// one published on the website, not this one.
await copyFile(join(androidRoot, "app-version.json"), join(www, "app-version.json"));

// Injected at the very top of <head> as a classic script. A module bundle is
// deferred by definition so it would run second either way, but placing this
// first means it stays first even if a plain <script> is added to the page
// later.
const indexPath = join(www, "index.html");
const html = await readFile(indexPath, "utf8");

if (!html.includes("<head>")) {
  console.error(`\nindex.html has no <head> to inject into:\n  ${indexPath}\n`);
  process.exit(1);
}

await writeFile(
  indexPath,
  html
    .replace("<head>", `<head>\n    <script src="/api-origin.js"></script>`)
    // Deferred: the update notice must never delay the storefront painting.
    .replace("</body>", `  <script defer src="/update-check.js"></script>\n  </body>`),
  "utf8",
);

// The running app compares itself against the copy on the website, so that
// copy has to ship with the next web deploy. Writing it from here keeps
// app-version.json a single file to edit — bump it once, and both the APK and
// the site agree about what the current version is.
const published = resolve(androidRoot, "..", "web", "public", "app-version.json");
await copyFile(join(androidRoot, "app-version.json"), published);

console.log(`Staged web build   -> ${www}`);
console.log(`API origin         -> ${API_ORIGIN}`);
console.log(`App version        -> ${APP_VERSION} (code ${APP_VERSION_CODE})`);
console.log(`Service worker     -> removed (assets are bundled)`);
console.log(`Published version  -> ${published}`);
console.log(`                      commit this so the site can offer updates`);
