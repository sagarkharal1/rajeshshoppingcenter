import { pgTable, serial, text, numeric, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  customerCode: text("customer_code"),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  customerAddress: text("customer_address").notNull(),
  customerPhotoPath: text("customer_photo_path"),
  items: jsonb("items").notNull().$type<Array<{
    productId: number;
    productName: string;
    price: number;
    quantity: number;
    unit: string;
  }>>(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("order-received"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  paymentMethod: text("payment_method").notNull().default("bank"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  serviceType: text("service_type").notNull(), // jeep | tractor
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  pickupLocation: text("pickup_location").notNull(),
  destination: text("destination").notNull(),
  bookingDate: text("booking_date").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  // Financial fields — set by owner when confirming / collecting payment
  chargedAmount: numeric("charged_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("cash"),
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid | partial | paid
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });

export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
