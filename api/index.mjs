/*
 * Vercel serverless function for the whole API.
 *
 * This used to be `[...path].mjs`, chosen so that Express would see the real
 * request path rather than a rewrite destination. The reasoning was sound and
 * the result was not: the catch-all matched exactly ONE segment. `/api/products`
 * reached the app, `/api/admin/login` and `/api/cron/daily` never did — Vercel
 * answered them itself with NOT_FOUND before the function was ever invoked. Owner
 * login and the nightly backup were dead from the first deploy, and the failure
 * looked exactly like a wrong password.
 *
 * An explicit rewrite in vercel.json now sends every `/api/*` path here. Vercel
 * preserves the original URL through a rewrite, so Express still sees
 * `/api/admin/login`; the guard below is for the case where it does not, because
 * falling back to `/` would 404 in precisely the same silent way as the bug it
 * replaces.
 *
 * The handler is the esbuild bundle from
 * `pnpm --filter @workspace/api-server run build`, so this runs the same code as
 * the long-running server — same externals, same plugins, one build story.
 */
import app from "../artifacts/api-server/dist/serverless.mjs";

export default function handler(req, res) {
  if (!req.url || !req.url.startsWith("/api")) {
    const suffix = !req.url || req.url === "/" ? "" : req.url;
    req.url = `/api${suffix}`;
  }

  return app(req, res);
}
