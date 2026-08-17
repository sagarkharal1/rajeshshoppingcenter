# Migration plan — DigitalOcean → Vercel + Supabase (free tiers)

**Status:** Plan for review. Nothing has been changed.
**Goal:** run the whole system inside Vercel Hobby and Supabase Free.
**Date:** 2026-08-16

---

## Verdict

**Feasible**, but only with three mandatory code changes and two risks that no amount
of minimising can remove. Both risks are policy, not engineering.

---

## 1. The limits we must fit inside

Verified August 2026:

| Limit | Value | What it costs us |
|---|---|---|
| Vercel Hobby cron | **Once per day**, hour-accurate, UTC | The 30-second Telegram queue worker cannot exist |
| Vercel Hobby terms | **No commercial use** | See Risk 1 |
| Supabase free DB | **500 MB**, shared CPU/RAM | Base64 images must leave Postgres |
| Supabase free storage | 1 GB | Enough for shop images, for now |
| Supabase free backups | **None.** No downloadable backups, no PITR | Our own backup becomes the only copy |
| Supabase free pause | After **7 days** with no API requests | Mitigated below |
| Supabase free projects | 2 active max | Fine |

---

## 2. Two risks that minimising cannot fix

### Risk 1 — Vercel Hobby forbids commercial use

Vercel's Hobby plan is for non-commercial personal projects. This shop sells goods and
takes payment, which is commercial by any ordinary reading. The consequence, if
enforced, is the project being suspended — the shop's website going dark without notice.

Not a technical problem and not solvable by making the app smaller. It is a decision to
take knowingly. Vercel Pro is roughly $20/mo; alternatively the frontend can sit on
**Cloudflare Pages**, whose free tier does not carry the same restriction.

### Risk 2 — the free plan gives the shop no backups

Today there are two safety nets: DigitalOcean's managed-Postgres backups, and the app's
own 24-hour backup to Spaces. On Supabase free, the first disappears entirely.

The app's own backup then becomes **the only copy of every invoice, payment and udharo
balance** — and on Hobby it can run at most once a day. A silent failure means
discovering the loss at the worst moment.

Mitigation, non-negotiable if we do this:

- Back up **off-platform** — Cloudflare R2 or Backblaze B2 (both ~10 GB free), never
  Supabase Storage. A backup on the same platform as the database is not a backup.
- Keep the existing backup status panel prominent. It already shows green/red, and
  HANDOVER.md already tells the owner to report a red warning.
- Accept a worst case of **24 hours of lost records**, versus minutes today.

---

## 3. Mandatory code changes

### 3.1 Move images out of Postgres — *blocking*

Product photos, bill photos, payment proofs and the proof register are stored as base64
data URIs directly in table columns, up to 500,000 characters (~375 KB binary) each:

- `routes/orders.ts:40-41` — customer photo, payment screenshot
- `routes/business.ts:78,95,103` — invoice and payment proofs
- `routes/admin.ts:2517` — proof path

At 500 MB total database, a few hundred photos exhaust the plan. This must move to
Supabase Storage (1 GB free) before anything else.

Work:
- Upload endpoint writes to Supabase Storage, stores the returned key.
- `getImageUrl()` (`artifacts/web/src/lib/utils.ts`) resolves keys to storage URLs. It
  already passes through anything matching `data:`/`http`, so existing rows keep
  rendering during the transition.
- One-off script converting existing base64 rows to storage objects.

Worth doing **regardless of hosting** — it shrinks the database and every backup.

### 3.2 Make OTP delivery synchronous — *blocking*

`sendTelegramMessage()` (`utils/telegram-service.ts:96`) returns `void`. It writes to
`telegram_queue`, then attempts delivery *after* the handler has responded. Anything
that fails is retried by `startTelegramQueueWorker()` every 30 seconds
(`telegram-service.ts:184`, started at `index.ts:35`).

On Vercel: the trailing work can be killed when the function freezes, and the retry
worker cannot exist — the best we get is once a day.

**A login code that arrives up to 24 hours late is a lock-out.** The owner's recovery
path (HANDOVER.md §4) depends on this.

Work:
- OTP sends become `await`ed inside the request. If Telegram fails, the login page says
  so, instead of the user waiting for a code that never comes.
- The queue stays as a safety net for non-urgent messages (new order, new booking),
  drained by the daily cron.
- Non-urgent fire-and-forget sends wrap in `waitUntil()` so they survive the response.

This is a better design than today's regardless of where it runs.

### 3.3 Rehome the two background workers — *blocking*

`index.ts:35-36` starts both workers in a long-running process that Vercel does not have.

| Worker | Today | On Vercel Hobby |
|---|---|---|
| Telegram queue | every 30s | daily cron, best-effort only (see 3.2) |
| Scheduled backup | every 24h | daily cron — fits exactly |

One `/api/cron/daily` endpoint doing both, protected by `CRON_SECRET`.

**Bonus:** that daily request is itself API activity, which keeps the Supabase project
from pausing. Risk of the 7-day pause effectively disappears.

### 3.4 Connection pooling — small

Serverless opens a pool per instance. Use Supabase's **transaction pooler** (port 6543)
and set `DATABASE_POOL_MAX=1`. That env var already exists
(`lib/db/src/index.ts`), so this is configuration, not code.

### 3.5 Drop the DigitalOcean SSL workaround — small

`lib/db/src/index.ts` strips `sslmode` and sets `rejectUnauthorized: false` to accept
DO's self-signed CA. Supabase presents a valid certificate; verification should be
turned back on rather than inherited.

### 3.6 Express as one serverless function — small

`vercel.json` rewriting `/api/*` to a single catch-all that mounts the existing Express
app. The static build already outputs to `artifacts/web/dist/public`.

---

## 4. Data migration

The dangerous part. Every invoice, payment and udharo balance moves.

1. **Freeze writes.** Pick a genuinely quiet hour — the shop is in Nepal (UTC+5:45).
2. `pg_dump` from DigitalOcean.
3. Restore into Supabase.
4. **Verify before cutover** — do not trust a clean exit code:
   - row counts per table, old vs new
   - `SUM(balance)` across `customers` — the udharo total must match **exactly**
   - `SUM(total_amount)` and `SUM(amount_paid)` across `invoices` and `orders`
   - newest invoice number and newest payment id identical
5. Only then repoint DNS.
6. Keep the DigitalOcean database **running and untouched for at least two weeks.**
   It is the rollback.

A verification script belongs in `scripts/` alongside the money-path tests, so this is
repeatable rather than a one-off done by eye.

---

## 5. Cutover and rollback

**Cutover**
1. Deploy to Vercel on a preview URL, pointed at the migrated Supabase database.
2. Exercise the real paths: place an order, change its status, take a payment, void an
   invoice, request a login OTP, run a backup by hand.
3. `pnpm --filter @workspace/scripts run test:money` — 91 checks must pass.
4. Lower DNS TTL a day ahead, then repoint.

**Rollback** — if anything is wrong, point DNS back at DigitalOcean. This works only
while the DO database is still running and has not diverged. That is why writes are
frozen during the move, and why DO stays up for two weeks.

---

## 6. What the shop gives up

| | DigitalOcean today | Vercel + Supabase free |
|---|---|---|
| Database backups | Managed + own 24h copy | **Own copy only, once a day** |
| Worst-case data loss | Minutes | **Up to 24 hours** |
| OTP retry | Every 30s for 2 hours | One immediate attempt |
| Support / SLA | Paid plan | **None** |
| Commercial use | Permitted | **Not permitted on Hobby** |
| Cost | ~$25–30/mo | $0 |

---

## 7. Sequence

1. **Images out of Postgres** (§3.1) — do this on DigitalOcean first. It is independent,
   valuable on its own, and shrinks what has to be migrated later.
2. OTP synchronous + `waitUntil` (§3.2) — also independent, also an improvement today.
3. Daily cron endpoint (§3.3).
4. Vercel serverless wrapper, pooling, SSL (§3.4–3.6).
5. Backup target moved to R2/B2.
6. Data migration and cutover (§4–5).

Steps 1 and 2 improve the current system whether or not the migration happens. If the
plan stalls after them, nothing is wasted.

---

## 8. Decisions needed

1. **Accept the Vercel Hobby commercial-use risk, or put the frontend on Cloudflare
   Pages instead?** Cloudflare Pages is free without that restriction and would remove
   Risk 1 entirely.
2. **Is 24-hour worst-case data loss acceptable** for the udharo ledger? This is the
   real cost of the free plan.
3. **Where do backups go** — Cloudflare R2 or Backblaze B2? Either is free at this size.
   Not Supabase.
4. **When can writes be frozen** for the migration window?

---

## Sources

- [Vercel: cron jobs per project limits](https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan)
- [Vercel: limits](https://vercel.com/docs/limits)
- [Supabase pricing and free-tier limits](https://uibakery.io/blog/supabase-pricing)
