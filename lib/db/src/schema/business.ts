import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  customerCode: text("customer_code"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  photoPath: text("photo_path"),
  rewardPoints: integer("reward_points").notNull().default(0),
  creditBalance: numeric("credit_balance", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  totalSpent: numeric("total_spent", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id),
  invoiceNumber: text("invoice_number").notNull(),
  subtotalAmount: numeric("subtotal_amount", { precision: 12, scale: 2 }).notNull(),
  previousDueAmount: numeric("previous_due_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  dueAmount: numeric("due_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("cash"),
  paymentStatus: text("payment_status").notNull().default("paid"),
  rewardPointsEarned: integer("reward_points_earned").notNull().default(0),
  note: text("note"),
  printedAt: timestamp("printed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoiceItemsTable = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoicesTable.id),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull().default("piece"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customerPaymentsTable = pgTable("customer_payments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  referenceNote: text("reference_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customerLedgerTable = pgTable("customer_ledger", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id),
  paymentId: integer("payment_id").references(() => customerPaymentsTable.id),
  entryType: text("entry_type").notNull(),
  description: text("description").notNull(),
  debitAmount: numeric("debit_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  creditAmount: numeric("credit_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }).notNull().default("0"),
  metadata: jsonb("metadata").$type<Record<string, unknown> | null>().default(null),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rewardTransactionsTable = pgTable("reward_transactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
  createdAt: true,
});
export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({
  id: true,
  createdAt: true,
});
export const insertCustomerPaymentSchema = createInsertSchema(customerPaymentsTable).omit({
  id: true,
  createdAt: true,
});
export const insertCustomerLedgerSchema = createInsertSchema(customerLedgerTable).omit({
  id: true,
  createdAt: true,
});
export const insertRewardTransactionSchema = createInsertSchema(
  rewardTransactionsTable,
).omit({
  id: true,
  createdAt: true,
});

export type Customer = typeof customersTable.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type CustomerPayment = typeof customerPaymentsTable.$inferSelect;
export type InsertCustomerPayment = z.infer<typeof insertCustomerPaymentSchema>;
export type CustomerLedgerEntry = typeof customerLedgerTable.$inferSelect;
export type InsertCustomerLedgerEntry = z.infer<typeof insertCustomerLedgerSchema>;
export type RewardTransaction = typeof rewardTransactionsTable.$inferSelect;
export type InsertRewardTransaction = z.infer<typeof insertRewardTransactionSchema>;
