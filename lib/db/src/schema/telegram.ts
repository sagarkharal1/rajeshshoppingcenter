import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const telegramQueueTable = pgTable("telegram_queue", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  chatId: text("chat_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | sent | failed
  attempts: integer("attempts").notNull().default(0),
  lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TelegramQueue = typeof telegramQueueTable.$inferSelect;
export type TelegramQueueInsert = typeof telegramQueueTable.$inferInsert;
