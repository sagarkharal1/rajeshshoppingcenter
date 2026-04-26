import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const stockLedgerTable = pgTable("stock_ledger", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  transactionType: text("transaction_type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  linkedEntityType: text("linked_entity_type"),
  linkedEntityId: integer("linked_entity_id"),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
});

export type StockLedger = typeof stockLedgerTable.$inferSelect;
export type StockLedgerInsert = typeof stockLedgerTable.$inferInsert;
