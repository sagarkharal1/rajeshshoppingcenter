import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

/**
 * Money owed to suppliers, and money paid to them.
 *
 * Dealer records used to be written onto the stock ledger, which meant every
 * entry had to name a product — so recording one supplier bill meant retyping
 * product names and quantities that had already been entered properly against
 * each product, and inventing a split when the bill covered a mixed load at
 * prices that change every delivery.
 *
 * A dealer bill is a debt, not a stock movement. Stock arrives through the
 * product screen, where the shop enters the real cost of each item. This table
 * holds only what the shopkeeper reads off the supplier's paper: whose bill it
 * is, its number, what it came to, what was handed over, and a photo of it.
 */
export const dealerTransactionsTable = pgTable("dealer_transactions", {
  id: serial("id").primaryKey(),
  /** "purchase" — a bill received. "payment" — money given to the dealer. */
  entryType: text("entry_type").notNull().default("purchase"),
  dealerName: text("dealer_name").notNull(),
  dealerPhone: text("dealer_phone"),
  /** Whatever reference the supplier's paper carries — bill, invoice, receipt. */
  billNumber: text("bill_number"),
  billAmount: numeric("bill_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  note: text("note"),
  // Kept rather than deleted, like every other money record in this shop, so a
  // correction leaves a trail instead of a hole.
  voidedAt: timestamp("voided_at"),
  voidReason: text("void_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DealerTransaction = typeof dealerTransactionsTable.$inferSelect;
export type DealerTransactionInsert = typeof dealerTransactionsTable.$inferInsert;
