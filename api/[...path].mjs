/*
 * Vercel serverless function for the whole API.
 *
 * A catch-all (`[...path]`) rather than a rewrite to a single named function,
 * because Express mounts its router at `/api` and needs to see the real request
 * path. A rewrite would hand the function the destination path instead, and
 * every route would 404.
 *
 * The handler itself is the esbuild bundle produced by
 * `pnpm --filter @workspace/api-server run build`, so the code that runs here is
 * built exactly like the long-running server — same externals, same plugins,
 * no second bundling story to keep in step.
 */
export { default } from "../artifacts/api-server/dist/serverless.mjs";
