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
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS proof_path TEXT`,
    // 2026-04: Add payment screenshot column to orders for digital payment proof
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_screenshot_path TEXT`,
    // 2026-05: Persist proof images on shop invoices and customer payments
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS proof_path TEXT`,
    `ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS proof_path TEXT`,
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

      const [settings] = await db.select().from(settingsTable).limit(1);
      if (!settings) {
        await db.insert(settingsTable).values(DEFAULT_SETTINGS as any);
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
