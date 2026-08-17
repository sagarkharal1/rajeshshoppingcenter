# PRD — Remaining gaps

**Status:** Draft for review
**Date:** 2026-08-16
**Covers:** the features from the original build spec that are still missing after the
Android app and customer redesign shipped (`c3c2c33`).

This is written to be built from. Every claim about the current system was checked
against the code and is cited, so nobody has to re-derive it. Where a decision is
genuinely the owner's, it is listed in [Open questions](#open-questions) rather than
guessed at.

---

## 1. Current state, verified

| Area | Reality today | Evidence |
|---|---|---|
| Admin identity | **One** shared credential. JWT payload is `{ admin: true }` — no user, no role. | `artifacts/api-server/src/routes/admin.ts:402` |
| Authorisation | `authMiddleware` verifies the signature and nothing else. Any valid token = full owner access, including udharo and voids. | `artifacts/api-server/src/lib/auth.ts:18-29` |
| Order assignment | No concept of it. `orders` has no assignee, no delivery proof, no delivered-at. | `lib/db/src/schema/orders.ts:5-31` |
| Notifications sent | Exactly **4**: login OTP, recovery OTP, new order, new booking. All to the shop's own Telegram. | `admin.ts:347`, `admin.ts:527`, `orders.ts:304`, `orders.ts:577` |
| Order **status change** | Notifies **nobody** — not the customer, not the owner. | `admin.ts:1057` (`PUT /admin/orders/:id/status`) |
| Customer notifications | None exist, by any channel, ever. | — |
| WhatsApp | **Dead code.** Two near-duplicate modules, 337 lines. Only `invalidateWhatsAppCache` is imported; `sendWhatsApp` is never called. | `utils/whatsapp.ts`, `utils/whatsapp-service.ts` |
| Store hours / holidays | No fields in `settings`. | `lib/db/src/schema/settings.ts` |
| Contact form | None. The About page prints a phone number. | `artifacts/web/src/pages/about-page.tsx` |
| Reorder | None. Order history is read-only. | `artifacts/web/src/pages/account-page.tsx` |

### Order pipeline (unchanged, for reference)

```
order-received → confirmed → preparing → dispatched → delivered
                                                    ↘ cancelled
```
`admin.ts:1053`

---

## 2. Scope

**In:** staff & delivery panel with roles; customer order notifications; store hours &
holidays; contact form; reorder. Plus removing the dead WhatsApp modules, because the
notification work lands on top of them.

**Out:** customer accounts with passwords (the code+phone model is a deliberate fit for
a village — see [Open questions](#open-questions)); reviews and ratings; wishlist;
newsletter; multi-store; visitor analytics; eSewa/Khalti gateway integration (QR plus
phone confirmation matches how the shop already works and adds a failure mode on patchy
internet).

---

## 3. Feature: Staff & delivery panel

**The largest gap, and the only one requiring a schema and auth change.**

### Problem

The shop cannot give anyone access without giving them everything. There is one
password, and holding it means seeing every customer's udharo balance and being able to
void invoices. So delivery work either happens on the owner's own phone, or not in the
app at all — and there is no record of who delivered what.

### Users

- **Owner** — full access, as today.
- **Staff** — sees orders assigned to them, moves them along the pipeline, records a
  delivery. Sees no money beyond what to collect on a specific order.

### User stories

1. As the owner, I assign an order to a staff member so they know it is theirs.
2. As staff, I open the app and see only my assigned orders, newest first.
3. As staff, I mark an order packed, then dispatched, then delivered.
4. As staff, I take a photo at handover so there is proof of delivery.
5. As the owner, I see who delivered an order and when, and I can open the photo.
6. As the owner, I deactivate a staff account when someone stops working here.

### Requirements

**Must**

- A real user record: id, display name, username, password hash, role
  (`owner` | `staff`), active flag, created-at.
- JWT carries the user id and role. `authMiddleware` keeps working for shared
  endpoints; a new `requireRole("owner")` guards everything that touches money.
- Staff can read and update **only** orders assigned to them.
- Staff can move an order between `preparing`, `dispatched`, `delivered`.
- Delivery capture: photo, timestamp, and the delivering user, stored on the order.
- Owner can create, deactivate and reset staff accounts from the owner area.
- Every owner-only endpoint returns **403** to a staff token. This must be enforced
  server-side; hiding a button is not access control.

**Must not**

- Staff must never see udharo balances, customer ledgers, dealer records, reports,
  backups, or the audit log.
- Staff must never void an invoice or a payment.

**Should**

- The staff screen is bilingual, like every other owner-facing screen.
- Delivery photos reuse the existing upload path used by the proof register.

### Acceptance criteria

- [ ] A staff token calling any `/admin/customers*`, `/admin/invoices*`,
      `/admin/payments*`, `/admin/dashboard-summary` or `/admin/credit-analysis`
      endpoint receives 403.
- [ ] A staff token calling `PUT /admin/orders/:id/status` for an order assigned to
      someone else receives 403.
- [ ] Marking delivered without a photo behaves per the decision in
      [Open questions](#open-questions) — and behaves the same way in the API as in the UI.
- [ ] The owner's existing login continues to work unchanged through the migration.
- [ ] Order detail shows the delivering user's name, the timestamp, and the photo.
- [ ] `pnpm --filter @workspace/scripts run test:money` still passes 91/91.

### Technical notes

- New table `users`. Do **not** migrate the owner credential out of `settings` in the
  same change — see Risks. Add users alongside, and let the existing owner login keep
  working against `settings` until staff login is proven.
- `orders` gains `assigned_to_user_id`, `delivery_proof_path`, `delivered_at`,
  and optionally `delivery_note`.
- JWT payload becomes `{ sub: <userId>, role: "owner" | "staff" }`. Existing tokens
  carry `{ admin: true }` and will fail the new checks — treat a token without a role
  as `owner` for one release, then drop that fallback, so nobody is logged out mid-shift.
- Rate limiting already exists and is database-backed (`lib/rate-limits.ts`); staff
  login should use it too.

### Effort

Largest item here. Schema migration, auth rework, one new owner screen, one new staff
screen. Worth doing first because everything else is small by comparison.

---

## 4. Feature: Customer order notifications

### Problem

A customer places an order and then hears nothing. The status moves to `dispatched` and
they have no idea. Their only recourse is to open the site and check, or phone the shop —
which is exactly the load the app was meant to remove.

Note this is not a "wire up the existing WhatsApp" job. **The WhatsApp code is dead**,
and it could not serve customers anyway: it uses CallMeBot, where *each recipient* must
generate their own API key. That is a fine one-time setup for the owner. It is
impossible for walk-up customers.

### User stories

1. As a customer, I am told when my order is confirmed.
2. As a customer, I am told when it is on its way.
3. As a customer, I am told when it is marked delivered.
4. As the owner, I am told when an order's status changes, so I can see work happening.
5. As the owner, I can turn notifications off if they cost too much.

### Requirements

**Must**

- `PUT /admin/orders/:id/status` sends a notification on transition to `confirmed`,
  `dispatched`, `delivered` and `cancelled`.
- Message content is bilingual and includes the order code and the amount due.
- Sending failures never fail the status update. A customer's order must not get stuck
  because a message could not go out.
- Delivery is attempted at most once per transition; a retry must not double-send.
- The owner can disable customer notifications from settings.

**Should**

- Delivery outcome is recorded so the owner can see what was sent and what failed.
- The existing `telegram_queue` table suggests a queueing pattern already understood
  here; reuse it rather than inventing a second one.

### Acceptance criteria

- [ ] Moving an order to `dispatched` sends exactly one customer message.
- [ ] Moving it to `dispatched` twice sends one message, not two.
- [ ] With the notification provider unreachable, the status still changes and the
      response is still 200.
- [ ] With customer notifications disabled, no customer message is sent and the owner
      notification still is.
- [ ] No message contains a udharo balance or any other customer's data.

### Technical notes

- Choice of channel is an [open question](#open-questions) with a real running cost.
- `sendWhatsApp(message)` takes no recipient (`whatsapp-service.ts:69`); any customer
  channel needs a per-recipient signature. Do not extend the dead module — delete it
  (§8) and write the new sender against whichever provider is chosen.
- `formatStatusMessage` already exists and is unused; its wording is a reasonable
  starting point for the customer copy.

---

## 5. Feature: Store hours & holidays

### Problem

The shop closes for festivals. Customers still place orders, then wait, then phone.
Nothing in the app knows the shop is shut.

### Requirements

**Must**

- Owner sets weekly opening and closing times, and a list of closed dates with an
  optional reason (e.g. दशैं).
- The storefront shows open/closed state, and when it will next open.
- Closed dates are entered and displayed in **Bikram Sambat**, consistent with the rest
  of the owner UI (`lib/nepal-time.ts` already handles BS formatting).

**Should**

- While closed, checkout warns that the order will be handled when the shop reopens.
  It should still accept the order — a village shop takes orders out of hours.

### Acceptance criteria

- [ ] Setting today as a holiday makes the storefront show closed within one refresh.
- [ ] The closed notice is correct in both languages.
- [ ] Ordering while closed still succeeds and still notifies the owner.

### Technical notes

Settings-level fields plus a small `shop_closures` table for dated exceptions. No
changes to orders. Small, and high value for a shop that closes for festivals.

---

## 6. Feature: Contact / inquiry form

### Problem

The only way to ask a question is to phone. That costs the customer money and the shop
attention, and nothing is written down.

### Requirements

- Name, phone, message. Phone required — it is how the shop replies.
- Submissions notify the owner through the same path as orders.
- Stored so they are not lost if a notification fails.
- Rate limited, reusing `lib/rate-limits.ts`. A public unauthenticated form on a shop
  site will be found by spam.

### Acceptance criteria

- [ ] A submission is stored and the owner is notified.
- [ ] Submitting many times in quick succession is throttled.
- [ ] Failure to notify still stores the message and still tells the customer it was
      received.

---

## 7. Feature: Reorder

### Problem

Village shopping is repetitive — the same rice, oil and dal every month. Today a
customer rebuilds that basket by hand every time.

### Requirements

- On order history, a "order this again" action fills the cart with the same items.
- Items that are gone or out of stock are skipped, and the customer is told which.
- Prices come from **today's** catalogue, never the old order.

### Acceptance criteria

- [ ] Reordering an order whose items are all in stock produces an identical cart.
- [ ] An item that has since gone out of stock is omitted, and named in a notice.
- [ ] A price that has changed shows today's price, not the historical one.

### Technical notes

Purely client-side against the existing cart (`lib/cart`). The smallest item in this
document, and the one most likely to be used daily.

---

## 8. Cleanup: remove the dead WhatsApp modules

`utils/whatsapp.ts` and `utils/whatsapp-service.ts` are 337 lines of near-duplicate,
uncalled code. Only `invalidateWhatsAppCache` is imported, and only to clear a cache for
a sender that never sends.

Leaving them is actively harmful to §4: the next person will reasonably assume WhatsApp
notifications exist and try to extend them, and will lose time discovering they never
worked. Delete both, keep the settings fields if the owner still wants a WhatsApp number
displayed, and write the customer sender fresh.

---

## 9. Sequencing

1. **Staff & delivery panel** — the only structural change. Everything else is easier
   once roles exist, and it is the biggest operational gap.
2. **Customer notifications** — highest customer-visible value, but pick the channel
   first (cost decision).
3. **Store hours & holidays** — small, and prevents a recurring festival-season problem.
4. **Reorder** — small, high daily value.
5. **Contact form** — smallest value of the five; the phone number already works.

Cleanup (§8) belongs with step 2, not before it.

---

## 10. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Locking the owner out during the auth change** | One credential, a non-technical user, and the shop's entire record behind it. | Add `users` alongside the existing login; do not move the owner credential in the same release. Accept old `{ admin: true }` tokens as owner for one release. |
| **Staff seeing udharo** | Informal credit is the most sensitive data the shop holds. | Enforce roles server-side and assert 403 in tests, not just hidden UI. |
| **Notification costs** | Per-message SMS on hundreds of orders adds up for a village shop. | Owner-facing on/off switch; decide channel with costs on the table. |
| **Money-path regressions** | Order settlement touches udharo. | `pnpm --filter @workspace/scripts run test:money` (91 checks) must pass on every change here. |
| **Deploying on `master`** | `deploy_on_push` — every push is live immediately. | Build on a branch; merge deliberately. |

---

## Open questions

These need the owner's answer before the related work starts.

1. **Which channel for customer notifications?** SMS via a Nepali gateway reaches every
   phone including feature phones and needs no internet, but costs per message.
   Push notifications inside the Android app are free but only reach people who
   installed it. WhatsApp Business API needs business verification and template
   approval. *This decision sets the cost of §4 and cannot be defaulted sensibly.*
2. **Is a delivery photo required to mark an order delivered, or optional?** Required
   gives real proof; optional avoids blocking a delivery when a phone camera fails or
   there is no light.
3. **How many staff, and do they share one account or get their own?** Individual
   accounts are the point of §3 — but if there is only ever one helper, a simpler
   design may be enough.
4. **Should customers get real accounts with passwords?** Currently out of scope: the
   code + phone lookup is a deliberate fit for customers who should not have to
   remember a password. Worth confirming that is still the intent.
5. **Should staff see the amount to collect on their assigned orders?** They need it to
   collect cash on delivery — but it is the one piece of money data they would see.
