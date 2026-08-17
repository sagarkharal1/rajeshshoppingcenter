# DigitalOcean exit checklist

**Context:** the database currently holds test data only — no real customer records,
invoices or udharo balances. That removes almost all of the risk from tearing this down,
so this list is short.

If real trading starts before the migration finishes, stop and re-read §5.

---

## Keep these four things

### 1. Secrets — they exist **only** in the DigitalOcean dashboard

`.do/app.yaml` stores placeholders. The real values are encrypted in DO and disappear
with the app. Copy each into a password manager first.

| Variable | Why it still matters with fake data |
|---|---|
| `TELEGRAM_BOT_TOKEN` | **The most important one.** Login codes and password recovery run through this bot. Lose it and you create a new bot and redo the setup. |
| `TELEGRAM_CHAT_ID` | Where those codes are delivered. |
| `ADMIN_JWT_SECRET` | Can be regenerated — doing so just logs everyone out. Copy it anyway; it costs nothing. |
| `BACKUP_SPACES_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | Only needed if you want the old backups. Probably not, given the data is fake. |

### 2. DNS — the real risk here

`.do/app.yaml` declares `zone: rajeshshoppingcenter.com.np`, which suggests DigitalOcean
is hosting the DNS zone.

**The domain is real even though the data isn't.** If DO manages the zone and the
project is deleted, the domain stops resolving entirely.

Before deleting:

1. **Networking → Domains** in DigitalOcean
2. Screenshot or export **every** record — A, AAAA, CNAME, MX, TXT, NS
3. Note any **MX** (email) and **TXT** (verification) records especially
4. Confirm where the domain is *registered* — `.com.np` registration is separate from
   DNS hosting, and the registrar login is what you need to repoint it later

Do not delete the DO project until DNS is served elsewhere and confirmed working.

### 3. Shop settings — real configuration, even with fake transactions

The `settings` table is genuine work, not test data: shop name, address, phone, bank
account details, eSewa and Khalti IDs, the uploaded QR code images, shop and banner
photos, the stamp and signature images, reward point rules, and the admin username,
password hash and 2FA secret.

Re-entering that by hand is tedious and easy to get wrong. Take one backup:

Owner area → **Reports** → Backup panel → create and download the **SQL** backup.

That single file also carries the product catalogue and categories, so you do not have
to rebuild 31 products by hand either.

### 4. Nothing else

The application code is in git and pushed to GitHub. The Android signing keystore lives
in `artifacts/android/` and OneDrive, untouched by any of this.

---

## What you can now skip

Because the data is fake, all of this is unnecessary:

- `pg_dump` with verified row counts and balance sums
- Downloading the historical Spaces backups
- A frozen write window during migration
- Running both environments in parallel for two weeks
- Rollback planning for the database

The migration plan in `MIGRATION-vercel-supabase.md` §4 and §5 was written for live
financial records. With test data you can simply point the new environment at a fresh
Supabase database, import the settings backup, and move on.

---

## Deletion order

1. Grab the four items above
2. Confirm DNS is served from somewhere other than DigitalOcean
3. Delete the App Platform app
4. Delete the managed database
5. Delete the Spaces bucket
6. Remove the DNS zone — only once the domain resolves elsewhere
7. Check the account for leftovers — other apps, droplets, snapshots, volumes

---

## 5. If real trading starts before this is finished

Everything above changes. A shop that has recorded even one real udharo balance needs
the full treatment: verified `pg_dump`, matching balance sums, a frozen write window,
and the old database kept alive for two weeks as the rollback. Say so and I will restore
the long version of this document.
