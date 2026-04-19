import { db } from "@workspace/db";
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

export async function ensureBootstrapData(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
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
