# Why `vercel.json` looks the way it does

JSON has no comments and Vercel rejects unknown keys, so the reasoning lives here.

## `outputDirectory: artifacts/web/dist/public`

Where Vite already builds to (`artifacts/web/vite.config.ts`). Unchanged from the
DigitalOcean setup, which pointed its static site at the same folder.

## The catch-all rewrite

```json
{ "source": "/((?!api/).*)", "destination": "/index.html" }
```

The app routes in the browser, so `/catalog`, `/book`, `/track` and the rest exist only
once `index.html` has loaded — there are no such files on disk. Without this, a direct
visit, a refresh, or a shared link to anything but `/` returns 404. It is the same job
`catchall_document: index.html` did in `.do/app.yaml`.

Two details that make it safe:

- **Rewrites run after the filesystem check**, so real assets (`/assets/*.js`,
  `/icons/*`, `/download/rajesh-shop.apk`, `/app/index.html`) are served normally and
  never hit the rewrite.
- `(?!api/)` keeps `/api/*` out of it, because those belong to the function.

## The API function is a catch-all, not a rewrite

`api/[...path].mjs`, not `api/index.mjs` plus a rewrite.

Express mounts its router at `/api` (`app.ts:74`), so it needs to see the real request
path. Rewriting `/api/(.*)` to a single named function hands the function the
*destination* path instead, and every route 404s. A catch-all preserves `req.url`.

## The cron

```json
{ "path": "/api/cron/daily", "schedule": "0 20 * * *" }
```

Replaces the two background workers a long-running server used to run
(`api-server/src/index.ts:35-36`): draining the Telegram queue, and the scheduled
backup.

- **Vercel Hobby allows one cron per day**, and fires it anywhere within the hour.
  Anything more frequent fails at deploy time.
- `20:00 UTC` is `01:45` in Nepal (UTC+5:45) — the quietest hour for the shop.
- The request doubles as a keep-alive: a free Supabase project pauses after 7 days
  with no API requests, and this guarantees one a day.

Because the queue can only be drained daily, **login and recovery codes are sent
synchronously inside the request** instead of being queued — see
`sendTelegramOtpNow()` in `utils/telegram-service.ts`. A login code that arrives up to
24 hours later is a lock-out.

## Build order matters

```
api-server build && web build
```

`api/[...path].mjs` re-exports `artifacts/api-server/dist/serverless.mjs`, so the API
bundle has to exist before Vercel traces the function's imports.
