import { integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  shopName: text("shop_name").notNull().default("Rajesh Shopping Center"),
  proprietorName: text("proprietor_name").default("Sandesh Kharal"),
  phone: text("phone").notNull().default("+977-XXXXXXXXXX"),
  email: text("email"),
  address: text("address").notNull().default("Musikot-5, Aapchaur, Gulmi, Nepal"),
  bankName: text("bank_name"),
  accountName: text("account_name"),
  accountNumber: text("account_number"),
  bankBranch: text("bank_branch"),
  aboutText: text("about_text"),
  deliveryPolicy: text("delivery_policy"),
  termsConditions: text("terms_conditions"),
  shopPhotoPath: text("shop_photo_path"),
  ownerPhotoPath: text("owner_photo_path"),
  homeBannerPath: text("home_banner_path"),
  adminPasswordHash: text("admin_password_hash"),
  adminOtp: text("admin_otp"),
  adminOtpExpiry: text("admin_otp_expiry"),
  adminUsername: text("admin_username"),
  totpSecret: text("totp_secret"),
  totpPendingSecret: text("totp_pending_secret"),
  bankQrPath: text("bank_qr_path"),
  esewaId: text("esewa_id"),
  esewaQrPath: text("esewa_qr_path"),
  khaltiId: text("khalti_id"),
  khaltiQrPath: text("khalti_qr_path"),
  // Earning: rewardRate points for every rewardUnitAmount spent.
  rewardRate: integer("reward_rate").notNull().default(1),
  rewardUnitAmount: numeric("reward_unit_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("100"),
  // Spending: what one point is worth off a bill. At the default of 1, with
  // 1 point earned per NPR 100, a customer gets 1% back.
  rewardPointValue: numeric("reward_point_value", { precision: 10, scale: 2 })
    .notNull()
    .default("1"),
  // A declared offer period — "double points this week" — to draw customers
  // in. A multiplier of 1 means no offer is running.
  rewardBonusMultiplier: numeric("reward_bonus_multiplier", { precision: 5, scale: 2 })
    .notNull()
    .default("1"),
  rewardBonusLabel: text("reward_bonus_label"),
  rewardBonusStartsAt: timestamp("reward_bonus_starts_at"),
  rewardBonusEndsAt: timestamp("reward_bonus_ends_at"),
  invoiceFooter: text("invoice_footer"),
  whatsappPhone: text("whatsapp_phone"),
  whatsappApiKey: text("whatsapp_api_key"),
  announcements: jsonb("announcements").$type<Array<Record<string, unknown>>>(),
  featuredMedia: jsonb("featured_media").$type<Array<Record<string, unknown>>>(),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type Settings = typeof settingsTable.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
