# Roadmap

**Date:** 2026-08-16
**Decided:** website stays the main storefront; APK distribution stays (no Play Store);
customer app serves repeat buyers; owner side gets native only where web cannot reach.

Ordered so that every phase ships something usable on its own. If work stops after any
phase, nothing is half-built.

---

## Phase 0 — finish the move off DigitalOcean

*Days. Mostly done.*

Code is already written and green: serverless entry, `vercel.json`, daily cron, the
backup directory fix, Supabase-ready database config, and synchronous OTP delivery.

Remaining:

- Supabase project created, transaction pooler URL in hand
- Vercel project connected, environment variables set
- First deploy, then verify: storefront loads, admin login OTP arrives, `/api/cron/daily`
  responds
- Point `rajeshshoppingcenter.com.np` at the new host

**Blocked on:** accounts only.

---

## Phase 1 — stop the phone ringing

*Weeks. Small pieces, daily value, no new architecture.*

The shop's current load is people phoning to ask questions the app could answer.

| Item | Why it is first |
|---|---|
| **Customer order notifications** | A customer places an order and hears nothing, ever. Status changes notify nobody — not even the owner (`admin.ts:1057`). This is the single biggest hole. |
| **Store hours & holidays** | The shop closes for festivals; nothing in the app knows. Settings fields plus a badge. |
| **Reorder from history** | Village shopping is the same rice, oil and dal monthly. Smallest item here, used most. |
| **Delete the dead WhatsApp modules** | 337 lines across two near-duplicate files that nothing calls. Whoever builds notifications will otherwise waste a day assuming they work. |

On notifications: push via FCM works in a sideloaded APK (it needs Play Services on the
phone, not Play Store distribution). SMS reaches people without the app but costs per
message. Decide before starting — see `PRD-remaining-gaps.md` open questions.

---

## Phase 2 — the app worth installing

*Weeks. Mostly the web app, so it reaches the website and the APK at once.*

The design direction is agreed. Because the website stays primary and the APK wraps the
same build, this ships to both surfaces from one codebase.

- **उधारो visible to the customer** — the signature screen. The numbers already exist in
  `customers.credit_balance` and `customer_ledger`, already covered by the money-path
  tests. This screen only displays them.
- **Devanagari typography pass** — display sizes, the leading matras need, Nepali numerals.
- **Voice search** — typing Devanagari on a budget phone is slow; saying चामल is not.
- **Offline browsing that states it plainly** — the catalogue is saved, not broken.
- **Product photos.** None of the 31 products has one. No amount of design compensates.

Ends with a redesigned storefront on the web and a new APK build cut from it.

---

## Phase 3 — let someone else help

*Weeks. First real schema and auth change.*

From `PRD-remaining-gaps.md` §3. One password currently means full access to udharo and
voids, so delivery cannot be delegated without handing over everything.

- `users` table, roles (`owner` / `staff`), role-aware JWT
- Staff see only orders assigned to them
- Delivery capture: photo, timestamp, who delivered
- Owner-only endpoints return 403 to staff — enforced server-side and asserted in tests

**Do not move the owner credential out of `settings` in the same release.** One
credential, a non-technical user, and the shop's whole record behind it.

---

## Phase 4 — the shop never stops

*Months. The only phase that needs a second codebase.*

A native owner app for the two things a browser genuinely cannot do:

- **Offline billing.** Local database, queue the sale, sync when signal returns. Today if
  the internet drops your brother cannot bill at all.
- **Bluetooth thermal printing.** Every shop in Nepal has the printer; browsers cannot
  drive it.

Deliberately last, because it is the largest build and the only one that creates a second
codebase to maintain forever — `artifacts/mobile` is already one abandoned attempt at
exactly that.

**Worth checking before starting:** how often does the internet actually drop at the shop,
and for how long? If it is minutes a week, this phase may not be worth its cost. If it is
hours, it is the most valuable thing in this document. Nobody has measured it.

---

## Not planned

Carried from the PRD, still out of scope: customer accounts with passwords (the code +
phone model suits customers who should not have to remember one), reviews and ratings,
wishlist, newsletter, multiple stores, visitor analytics.

**eSewa / Khalti gateway integration** stays out for now. QR plus phone confirmation
matches how the shop already works. Worth revisiting in Phase 2 if the app makes retrying
a failed payment cheap.

---

## The two facts nobody has measured

Both change this order, and both are one conversation away:

1. **How often the internet drops at the shop, and for how long.** Decides whether
   Phase 4 is essential or expensive.
2. **Where the brother gets stuck in the owner screens today.** Decides whether Phase 3
   is the right shape, or whether something simpler is in the way first.

Everything above is inferred from the code. These two are not in the code.
