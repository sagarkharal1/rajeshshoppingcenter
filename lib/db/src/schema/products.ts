import { pgTable, serial, text, numeric, integer, boolean, timestamp, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("grid"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  buyingPrice: numeric("buying_price", { precision: 10, scale: 2 }).notNull().default("0"),
  transportationCost: numeric("transportation_cost", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  extraCost: numeric("extra_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  reorderLevel: integer("reorder_level").notNull().default(0),
  // Earliest expiry of the stock on the shelf. A single date per product is
  // what a shop this size can realistically keep up to date; the alert is a
  // prompt to go and look, not an inventory system.
  expiryDate: date("expiry_date"),
  // A temporary lower price. Outside the window — or with no sale price —
  // the normal price applies.
  salePrice: numeric("sale_price", { precision: 10, scale: 2 }),
  saleStartsAt: timestamp("sale_starts_at"),
  saleEndsAt: timestamp("sale_ends_at"),
  unit: text("unit").notNull().default("piece"),
  imageUrl: text("image_url"),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  inStock: boolean("in_stock").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true });
export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });

export type Category = typeof categoriesTable.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
