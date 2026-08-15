/*
 * Copies the signed release APK to where the website serves it from.
 *
 * The filename is deliberately stable — rajesh-shop.apk, with no version in
 * it — because the download page, printed cards and anything anyone has
 * shared point at that one URL. Putting the version in the filename would
 * break every link the moment a new build went out.
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const androidRoot = resolve(here, "..");

const apk = join(
  androidRoot,
  "android", "app", "build", "outputs", "apk", "release", "app-release.apk",
);

const downloadDir = resolve(androidRoot, "..", "web", "public", "download");
const target = join(downloadDir, "rajesh-shop.apk");

if (!existsSync(apk)) {
  console.error(
    `\nNo release APK at:\n  ${apk}\n\nBuild it first:\n  pnpm --filter @workspace/android run build:release\n`,
  );
  process.exit(1);
}

await mkdir(downloadDir, { recursive: true });
await copyFile(apk, target);

const { size } = await stat(target);
const mb = (size / (1024 * 1024)).toFixed(1);

console.log(`Published ${target}`);
console.log(`Size      ${mb} MB`);
console.log("");
console.log(`This APK is committed with the site, so every release adds about`);
console.log(`${mb} MB to the repository permanently. If that becomes a problem,`);
console.log(`host it on GitHub Releases instead and point the download page there.`);
