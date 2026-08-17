import { asc } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { categoriesTable, settingsTable } from "@workspace/db/schema";

const DEFAULT_SETTINGS = {
  shopName: "Rajesh Shopping Center",
  proprietorName: "Sandesh Kharal",
  phone: "+9779814401716",
  email: "rajeshshoppingcenter@gmail.com",
  address: "Musikot-5, Aapchaur, Gulmi, Nepal",
  rewardRate: 1,
  rewardUnitAmount: "100",
  invoiceFooter: "Rajesh Shopping Center | +9779814401716",
  whatsappPhone: "+9779814401716",
  announcements: [],
  featuredMedia: [],
} as const;

const DEFAULT_CATEGORY = {
  name: "General",
  description: "Default category for fresh setup",
  icon: "grocery",
  sortOrder: 1,
} as const;

let bootstrapPromise: Promise<void> | null = null;

async function runMigrations(): Promise<void> {
  // Safe incremental migrations — ADD COLUMN IF NOT EXISTS never fails on re-run
  const migrations = [
    // 2026-04: Add financial tracking columns to bookings
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS charged_amount NUMERIC(12,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash'`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'`,
    // 2026-07: Allow a mistyped invoice or payment to be voided instead of
    // leaving a customer's balance permanently wrong.
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS void_reason TEXT`,
    `ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP`,
    `ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS void_reason TEXT`,
    // 2026-07: Track how much of an order has actually been received so a
    // half-paid order can be recorded ("partial") instead of only paid/unpaid.
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0`,
    // Orders already marked paid before this column existed were paid in full.
    `UPDATE orders SET amount_paid = total_amount WHERE payment_status = 'paid' AND amount_paid = 0`,
    // 2026-08: Reward points become spendable, so a bill records how many were
    // used and what they were worth at that moment.
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reward_points_redeemed INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reward_discount NUMERIC(12,2) NOT NULL DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS reward_point_value NUMERIC(10,2) NOT NULL DEFAULT 1`,
    // 2026-08: A declared bonus period, e.g. double points during a festival.
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS reward_bonus_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS reward_bonus_label TEXT`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS reward_bonus_starts_at TIMESTAMP`,
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS reward_bonus_ends_at TIMESTAMP`,
    // 2026-08: Expiry tracking and temporary sale prices on products.
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2)`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMP`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMP`,
    // 2026-08: Rate limit counters, shared by every instance. Created here
    // with everything else rather than lazily on first use — a table that only
    // appears when a limiter fires is a table that silently never appears, and
    // the limiter then counts every request as the first one.
    `CREATE TABLE IF NOT EXISTS rate_limit_counters (
       bucket_key text NOT NULL,
       window_start timestamptz NOT NULL,
       hits integer NOT NULL DEFAULT 0,
       PRIMARY KEY (bucket_key, window_start)
     )`,
    // 2026-08: Dealer bills and payments in their own right. They lived on the
    // stock ledger, which forced every entry to name a product; a supplier's
    // bill is a debt, and stock arrives through the product screen instead.
    // 2026-08: exactly one settings row, enforced by the database.
    //
    // The owner's password hash, the TOTP secret and the payment IDs all live
    // on this row, and every read took whichever row Postgres felt like
    // returning. Two rows is not hypothetical: the seed below inserts defaults
    // when it finds none, and on serverless several cold instances can find
    // none at the same moment and all insert. That happened here — one row
    // held the real password and eSewa details, the other was bare defaults,
    // and the old password kept working whenever a login read the wrong one.
    //
    // Skipped rather than attempted when duplicates already exist: the index
    // cannot be created then, and a throw here fails bootstrap, which fails
    // every request. Consolidate first, and the guard takes hold on the next
    // start.
    `DO $$
     BEGIN
       IF (SELECT count(*) FROM settings) <= 1 THEN
         CREATE UNIQUE INDEX IF NOT EXISTS settings_single_row ON settings ((true));
       END IF;
     END $$`,
    `CREATE TABLE IF NOT EXISTS dealer_transactions (
       id serial PRIMARY KEY,
       entry_type text NOT NULL DEFAULT 'purchase',
       dealer_name text NOT NULL,
       dealer_phone text,
       bill_number text,
       bill_amount numeric(12,2) NOT NULL DEFAULT 0,
       paid_amount numeric(12,2) NOT NULL DEFAULT 0,
       note text,
       voided_at timestamp,
       void_reason text,
       created_at timestamp NOT NULL DEFAULT now()
     )`,
  ];
  const client = await pool.connect();
  try {
    for (const sql of migrations) {
      await client.query(sql);
    }
  } finally {
    client.release();
  }
}

export async function ensureBootstrapData(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await runMigrations();

      const [settings] = await db.select().from(settingsTable).orderBy(asc(settingsTable.id)).limit(1);
      if (!settings) {
        try {
          await db.insert(settingsTable).values(DEFAULT_SETTINGS as any);
        } catch (error) {
          // Another instance seeded it between the check above and here. With
          // the single-row index in place that now raises a unique violation
          // instead of quietly creating a second row — which is the point, but
          // it must not take the losing instance down with it.
          const code = (error as any)?.cause?.code ?? (error as any)?.code;
          if (code !== "23505") throw error;
        }
      }

      const categories = await db.select().from(categoriesTable).limit(1);
      if (!categories.length) {
        await db.insert(categoriesTable).values(DEFAULT_CATEGORY as any);
      }
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}

export async function getOrCreateDefaultCategoryId(): Promise<number> {
  await ensureBootstrapData();
  const [category] = await db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder).limit(1);
  if (!category) {
    const [created] = await db.insert(categoriesTable).values(DEFAULT_CATEGORY as any).returning();
    return created.id;
  }
  return category.id;
}
