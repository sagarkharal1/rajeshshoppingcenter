/*
 * Runs the Gradle wrapper in ./android with the task passed on the command line.
 *
 * Exists so the build works from a plain `pnpm run build:debug` on Windows,
 * where the wrapper is gradlew.bat and npm scripts cannot pick between the two.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const androidProject = resolve(here, "..", "android");

if (!existsSync(androidProject)) {
  console.error(
    `\nNo Android project at:\n  ${androidProject}\n\n` +
      `Create it once with:\n  pnpm --filter @workspace/android exec cap add android\n`,
  );
  process.exit(1);
}

const wrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const tasks = process.argv.slice(2);

if (tasks.length === 0) {
  console.error("\nNothing to run. Pass a Gradle task, e.g. assembleDebug.\n");
  process.exit(1);
}

const result = spawnSync(join(androidProject, wrapper), tasks, {
  cwd: androidProject,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
