import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { existsSync } from "fs";
import path from "path";
import { db } from "@workspace/db";
import {
  productsTable,
  categoriesTable,
  ordersTable,
  bookingsTable,
  invoicesTable,
  invoiceItemsTable,
  settingsTable,
  customersTable,
  customerPaymentsTable,
  customerLedgerTable,
  rewardTransactionsTable,
  auditLogsTable,
  stockLedgerTable,
  telegramQueueTable,
} from "@workspace/db/schema";
import { eq, sql, and, desc, ilike, inArray, or } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { generateSecret, generateURI, verifySync } from "otplib";
import { invalidateWhatsAppCache } from "../utils/whatsapp-service.js";
import { sendTelegramMessage } from "../utils/telegram-service.js";
import { z } from "zod";
import { ensureBootstrapData, getOrCreateDefaultCategoryId } from "../lib/bootstrap.js";
import { logAuditEntry, createAuditEntry } from "../lib/audit.js";
import { JWT_SECRET, authMiddleware } from "../lib/auth.js";
import {
  createJsonBackup,
  createSqlBackup,
  listLocalBackups,
  deleteLocalBackup,
  getBackupStatus,
  cleanupOldBackups,
} from "../lib/backup.js";
import { getScheduledBackupStatus, runScheduledBackup } from "../lib/scheduled-backup.js";

const scryptAsync = promisify(scrypt);
const router: IRouter = Router();

const ALLOWED_OWNER_IDENTIFIERS = new Set([
  "owner",
  "sandesh",
  "+9779814401716",
  "9814401716",
  "sandesh.kharal23@gmail.com",
  "rajeshshoppingcenter@gmail.com",
]);
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const OTP_TTL_MINUTES = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();
const categorySchema = z.object({
  name: z.string().min(1).max(120).transform((value) => value.trim()),
  description: z.string().max(400).optional(),
  icon: z.string().min(1).max(40).transform((value) => value.trim().toLowerCase()),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

function verifyTotp(token: string, secret: string): boolean {
  try {
    return Boolean(verifySync({ token, secret }));
  } catch {
    return false;
  }
}

function getClientKey(req: Request, identifier = ""): string {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  const ip = forwardedFor.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  return `${ip}:${identifier.trim().toLowerCase()}`;
}

function isLoginRateLimited(req: Request, identifier = ""): boolean {
  const key = getClientKey(req, identifier);
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt || now - attempt.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 0, firstAttemptAt: now });
    return false;
  }

  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(req: Request, identifier = "") {
  const key = getClientKey(req, identifier);
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt || now - attempt.firstAttemptAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: now });
    return;
  }

  attempt.count += 1;
}

function clearFailedLogins(req: Request, identifier = "") {
  loginAttempts.delete(getClientKey(req, identifier));
}

function rejectInvalidCredentials(req: Request, res: Response, identifier = "") {
  recordFailedLogin(req, identifier);
  return res.status(401).json({ error: "Invalid credentials" });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedHash] = hash.split(":");
  if (!salt || !storedHash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(storedHash, "hex");
  return derived.length === storedBuf.length && timingSafeEqual(derived, storedBuf);
}

async function isOwnerPasswordValid(password: string, storedHash: string | null): Promise<boolean> {
  // Default password only works when no custom password has been set yet.
  // Once the owner sets a custom password (storedHash exists), the default
  // password is permanently disabled — only the custom hash is accepted.
  if (!storedHash) return password === DEFAULT_PASSWORD;
  return verifyPassword(password, storedHash);
}

async function getSettings() {
  await ensureBootstrapData();
  const [settings] = await db.select().from(settingsTable).limit(1);
  return settings ?? null;
}

async function upsertSettings(values: Record<string, string | null>) {
  const existing = await getSettings();
  if (existing) {
    await db.update(settingsTable).set(values as any).where(eq(settingsTable.id, existing.id));
  } else {
    await db.insert(settingsTable).values(values as any);
  }
}

function generateOtp(length = 6): string {
  const digits = "0123456789";
  return Array.from(randomBytes(length))
    .map((byte) => digits[byte % digits.length])
    .join("")
    .slice(0, length);
}

function buildRecoveryMessage(code: string): string {
  return [
    "OWNER PASSWORD RESET",
    `Reset code: ${code}`,
    `Valid for: ${OTP_TTL_MINUTES} minutes`,
    "",
    "If you did not request this, ignore this message.",
    "Rajesh Shopping Center",
  ].join("\n");
}

function buildLoginOtpMessage(code: string): string {
  return [
    "OWNER LOGIN OTP",
    `Login code: ${code}`,
    `Valid for: ${OTP_TTL_MINUTES} minutes`,
    "",
    "If you did not request this, ignore this message.",
    "Rajesh Shopping Center",
  ].join("\n");
}

function matchesIdentifier(identifier: string, settings: any): boolean {
  const trimmed = identifier.trim();
  const normalizedEmail = trimmed.toLowerCase();
  const normalizedPhone = trimmed.replace(/[^\d+]/g, "");
  const normalizedDigits = trimmed.replace(/\D/g, "");

  return (
    ALLOWED_OWNER_IDENTIFIERS.has(trimmed) ||
    ALLOWED_OWNER_IDENTIFIERS.has(normalizedEmail) ||
    ALLOWED_OWNER_IDENTIFIERS.has(normalizedPhone) ||
    ALLOWED_OWNER_IDENTIFIERS.has(normalizedDigits)
  );
}

function normalizePhone(value: string | null | undefined): string {
  return String(value || "").replace(/[^\d+]/g, "");
}

function buildCustomerCode(id: number): string {
  return `CUST-${String(id).padStart(5, "0")}`;
}

async function findOrCreateCustomerForBooking(tx: any, booking: any) {
  const phone = normalizePhone(booking.customerPhone);
  const customers = await tx.select().from(customersTable);
  let customer = customers.find((entry: any) => entry.phone && normalizePhone(entry.phone) === phone);

  if (!customer) {
    customer = customers.find(
      (entry: any) =>
        entry.name.trim().toLowerCase() === String(booking.customerName || "").trim().toLowerCase()
    );
  }

  if (customer) {
    const [updated] = await tx
      .update(customersTable)
      .set({
        name: booking.customerName || customer.name,
        phone: booking.customerPhone || customer.phone,
        updatedAt: new Date(),
      } as any)
      .where(eq(customersTable.id, customer.id))
      .returning();
    return updated;
  }

  const [created] = await tx
    .insert(customersTable)
    .values({
      name: booking.customerName,
      phone: booking.customerPhone || null,
      customerCode: null,
    } as any)
    .returning();

  const [coded] = await tx
    .update(customersTable)
    .set({ customerCode: buildCustomerCode(created.id), updatedAt: new Date() } as any)
    .where(eq(customersTable.id, created.id))
    .returning();

  return coded;
}

function bookingDue(booking: any): number {
  return Math.max(0, Number(booking?.chargedAmount || 0) - Number(booking?.amountPaid || 0));
}

function summarizeDealerEntries(entries: Array<{ transactionType: string | null; metadata: Record<string, any> | null }>) {
  const dealerMap = new Map<string, { billed: number; paid: number; returns: number; damaged: number }>();

  for (const entry of entries) {
    const metadata = entry.metadata || {};
    const dealerName = String(metadata.dealerName || "").trim();
    if (!dealerName) continue;

    const dealerPhone = String(metadata.dealerPhone || "").trim();
    const key = `${dealerName.toLowerCase()}|${dealerPhone}`;
    const current = dealerMap.get(key) ?? { billed: 0, paid: 0, returns: 0, damaged: 0 };
    const type = String(entry.transactionType || "").toLowerCase();
    const billAmount = Number(metadata.billAmount || 0);
    const paidAmount = Number(metadata.paidAmount || 0);

    if (type === "dealer_payment") {
      current.paid += paidAmount;
    } else {
      current.billed += billAmount;
      current.paid += paidAmount;
    }
    if (type.includes("return")) current.returns += 1;
    if (type.includes("damage")) current.damaged += 1;

    dealerMap.set(key, current);
  }

  const dealers = Array.from(dealerMap.values());
  return {
    dealerCount: dealers.length,
    totalBilled: dealers.reduce((sum, dealer) => sum + dealer.billed, 0),
    totalPaid: dealers.reduce((sum, dealer) => sum + dealer.paid, 0),
    totalDue: dealers.reduce((sum, dealer) => sum + Math.max(0, dealer.billed - dealer.paid), 0),
    returnCount: dealers.reduce((sum, dealer) => sum + dealer.returns, 0),
    damagedCount: dealers.reduce((sum, dealer) => sum + dealer.damaged, 0),
  };
}

router.get("/admin/totp-status", async (_req, res) => {
  const settings = await getSettings();
  res.json({ totpEnabled: !!settings?.totpSecret });
});

router.post("/admin/login/request-otp", async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: "Username/email/phone and password are required" });
  }

  if (isLoginRateLimited(req, identifier)) {
    return res.status(429).json({ error: "Too many login attempts. Please wait 10 minutes and try again." });
  }

  const settings = await getSettings();

  if (!matchesIdentifier(identifier, settings)) {
    return rejectInvalidCredentials(req, res, identifier);
  }

  const storedHash = settings?.adminPasswordHash ?? null;
  const passwordOk = await isOwnerPasswordValid(password, storedHash);

  if (!passwordOk) {
    return rejectInvalidCredentials(req, res, identifier);
  }

  clearFailedLogins(req, identifier);
  const otp = generateOtp();
  const expiry = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  await upsertSettings({
    adminOtp: otp,
    adminOtpExpiry: expiry,
  });

  sendTelegramMessage(buildLoginOtpMessage(otp));

  const hasTelegramDelivery = Boolean(
    process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT || process.env.TELEGRAM_TOKEN
  ) && Boolean(
    process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_OWNER_CHAT_ID
  );

  res.json({
    message: hasTelegramDelivery
      ? "A login code was sent to your Telegram."
      : "Telegram is not configured — the login code could not be delivered. Please configure Telegram in settings.",
    recoveryChannel: hasTelegramDelivery ? "telegram" : "none",
  });
});

router.post("/admin/login", async (req, res) => {
  const { identifier, password, totp } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: "Username/email/phone and password are required" });
  }

  if (isLoginRateLimited(req, identifier)) {
    return res.status(429).json({ error: "Too many login attempts. Please wait 10 minutes and try again." });
  }

  const settings = await getSettings();

  if (!matchesIdentifier(identifier, settings)) {
    return rejectInvalidCredentials(req, res, identifier);
  }

  const storedHash = settings?.adminPasswordHash ?? null;
  const passwordOk = await isOwnerPasswordValid(password, storedHash);

  if (!passwordOk) {
    return rejectInvalidCredentials(req, res, identifier);
  }

  // ── TOTP check ────────────────────────────────────────────────────────────
  if (settings?.totpSecret) {
    if (!totp) {
      // Password is correct but TOTP code not provided yet — tell frontend to
      // show the authenticator prompt. Not an error, just a next-step signal.
      return res.json({ requiresTotp: true });
    }
    const totpOk = verifyTotp(String(totp).replace(/\s/g, ""), settings.totpSecret);
    if (!totpOk) {
      return res.status(401).json({ error: "Authenticator code is incorrect or has expired. Try the next code." });
    }
  }

  await upsertSettings({ adminOtp: null, adminOtpExpiry: null });
  clearFailedLogins(req, identifier);
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: "7d", algorithm: "HS256" });
  res.json({
    token,
    message: "Login successful",
    // No custom password set yet — the well-known default is still accepted,
    // so the UI must push the owner to change it.
    mustChangePassword: !storedHash,
  });
});

router.get("/admin/totp-setup", authMiddleware, async (_req, res) => {
  const secret = generateSecret();
  await upsertSettings({ totpPendingSecret: secret });

  const issuer = "Rajesh Shopping Center";
  const account = "admin";
  const uri = generateURI({ secret, label: account, issuer });

  res.json({ secret, uri, issuer, account });
});

router.post("/admin/totp-enable", authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Authenticator code is required" });
  }

  const settings = await getSettings();
  const pending = settings?.totpPendingSecret;
  if (!pending) {
    return res.status(400).json({ error: "No pending TOTP setup found. Please start setup again." });
  }

  const isValid = verifyTotp(code.replace(/\s/g, ""), pending);
  if (!isValid) {
    return res.status(401).json({ error: "Code is incorrect. Make sure your phone clock is accurate." });
  }

  await upsertSettings({ totpSecret: pending, totpPendingSecret: null });
  res.json({ message: "Google Authenticator enabled successfully" });
});

router.post("/admin/totp-disable", authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Authenticator code is required to disable 2FA" });
  }

  const settings = await getSettings();
  if (!settings?.totpSecret) {
    return res.status(400).json({ error: "Google Authenticator is not currently enabled" });
  }

  const isValid = verifyTotp(code.replace(/\s/g, ""), settings.totpSecret);
  if (!isValid) {
    return res.status(401).json({ error: "Code is incorrect. 2FA was not disabled." });
  }

  await upsertSettings({ totpSecret: null, totpPendingSecret: null });
  res.json({ message: "Google Authenticator disabled" });
});

router.post("/admin/change-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Both current and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }
  const settings = await getSettings();
  const storedHash = settings?.adminPasswordHash ?? null;
  let valid = false;
  if (storedHash) {
    valid = await verifyPassword(currentPassword, storedHash);
  } else {
    valid = currentPassword === DEFAULT_PASSWORD;
  }
  if (!valid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  const newHash = await hashPassword(newPassword);
  await upsertSettings({ adminPasswordHash: newHash });
  res.json({ message: "Password changed successfully" });
});

router.post("/admin/forgot-password", async (req, res) => {
  const identifier = typeof req.body?.identifier === "string" ? req.body.identifier.trim() : "";
  if (!identifier) {
    return res.status(400).json({ error: "Username/email/phone is required" });
  }

  const settings = await getSettings();
  if (!matchesIdentifier(identifier, settings)) {
    return res.status(401).json({ error: "This owner identifier is not allowed" });
  }

  const otp = generateOtp();
  const expiry = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await upsertSettings({
    adminOtp: otp,
    adminOtpExpiry: expiry,
  });

  sendTelegramMessage(buildRecoveryMessage(otp));

  const hasTelegramDelivery = Boolean(
    process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT || process.env.TELEGRAM_TOKEN
  ) && Boolean(
    process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_OWNER_CHAT_ID
  );

  res.json({
    message: hasTelegramDelivery
      ? "A password reset code was sent to your Telegram."
      : "Telegram is not configured — the reset code could not be delivered. Please configure Telegram in settings.",
    recoveryChannel: hasTelegramDelivery ? "telegram" : "none",
  });
});

router.post("/admin/reset-password", async (req, res) => {
  const identifier = typeof req.body?.identifier === "string" ? req.body.identifier.trim() : "";
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!identifier || !otp || !newPassword) {
    return res.status(400).json({ error: "Identifier, reset code, and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }

  const settings = await getSettings();
  if (!matchesIdentifier(identifier, settings)) {
    return res.status(401).json({ error: "This owner identifier is not allowed" });
  }

  if (!settings?.adminOtp || !settings?.adminOtpExpiry) {
    return res.status(400).json({ error: "No reset code found. Request a new one first." });
  }

  if (new Date(settings.adminOtpExpiry).getTime() < Date.now()) {
    await upsertSettings({ adminOtp: null, adminOtpExpiry: null });
    return res.status(400).json({ error: "Reset code expired. Request a new one." });
  }

  if (settings.adminOtp !== otp) {
    return res.status(401).json({ error: "Reset code is incorrect" });
  }

  const adminPasswordHash = await hashPassword(newPassword);
  // Also disable TOTP so a lost-phone owner can log in on a new device and
  // re-scan the QR code to set up Google Authenticator again.
  await upsertSettings({
    adminPasswordHash,
    adminOtp: null,
    adminOtpExpiry: null,
    totpSecret: null,
    totpPendingSecret: null,
  });

  res.json({ message: "Password reset successful. Google Authenticator has been disabled — log in and re-enable it on your new device." });
});

router.get("/admin/products", authMiddleware, async (_req, res) => {
  try {
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        sku: productsTable.sku,
        price: productsTable.price,
        buyingPrice: productsTable.buyingPrice,
        transportationCost: productsTable.transportationCost,
        extraCost: productsTable.extraCost,
        stockQuantity: productsTable.stockQuantity,
        reorderLevel: productsTable.reorderLevel,
        unit: productsTable.unit,
        imageUrl: productsTable.imageUrl,
        categoryId: productsTable.categoryId,
        categoryName: categoriesTable.name,
        inStock: productsTable.inStock,
        featured: productsTable.featured,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id));
    res.json(products);
  } catch {
    res.status(500).json({ error: "Failed to get products" });
  }
});

router.get("/admin/categories", authMiddleware, async (_req, res) => {
  try {
    const categories = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        description: categoriesTable.description,
        icon: categoriesTable.icon,
        sortOrder: categoriesTable.sortOrder,
        productCount: sql<number>`count(${productsTable.id})`,
      })
      .from(categoriesTable)
      .leftJoin(productsTable, eq(productsTable.categoryId, categoriesTable.id))
      .groupBy(categoriesTable.id)
      .orderBy(categoriesTable.sortOrder, categoriesTable.name);

    res.json(categories.map((category) => ({ ...category, productCount: Number(category.productCount ?? 0) })));
  } catch {
    res.status(500).json({ error: "Failed to get categories" });
  }
});

router.post("/admin/categories", authMiddleware, async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid category", details: parsed.error.issues });
  }

  try {
    const [category] = await db
      .insert(categoriesTable)
      .values({
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        icon: parsed.data.icon,
        sortOrder: parsed.data.sortOrder,
      })
      .returning();

    res.status(201).json({ ...category, productCount: 0 });
  } catch {
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/admin/categories/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = categorySchema.safeParse(req.body);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid category ID" });
  }
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid category", details: parsed.error.issues });
  }

  try {
    const [category] = await db
      .update(categoriesTable)
      .set({
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        icon: parsed.data.icon,
        sortOrder: parsed.data.sortOrder,
      })
      .where(eq(categoriesTable.id, id))
      .returning();

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const [productCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(productsTable)
      .where(eq(productsTable.categoryId, id));

    res.json({ ...category, productCount: Number(productCount?.count ?? 0) });
  } catch {
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/admin/categories/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid category ID" });
  }

  try {
    const [productCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(productsTable)
      .where(eq(productsTable.categoryId, id));

    if (Number(productCount?.count ?? 0) > 0) {
      return res.status(400).json({ error: "Move or delete products in this category before deleting it." });
    }

    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.json({ message: "Category deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

router.post("/admin/products", authMiddleware, async (req, res) => {
  try {
    const {
      name,
      description,
      sku,
      price,
      buyingPrice,
      transportationCost,
      extraCost,
      stockQuantity,
      reorderLevel,
      unit,
      imageUrl,
      categoryId,
      inStock,
      featured,
    } = req.body;
    const resolvedCategoryId = Number(categoryId) > 0 ? Number(categoryId) : await getOrCreateDefaultCategoryId();
    const [product] = await db
      .insert(productsTable)
      .values({
        name,
        description,
        sku,
        price: price.toString(),
        buyingPrice: (buyingPrice ?? 0).toString(),
        transportationCost: (transportationCost ?? 0).toString(),
        extraCost: (extraCost ?? 0).toString(),
        stockQuantity: stockQuantity ?? 0,
        reorderLevel: reorderLevel ?? 0,
        unit,
        imageUrl,
        categoryId: resolvedCategoryId,
        inStock: inStock ?? true,
        featured: featured ?? false,
      })
      .returning();
    res.status(201).json({
      ...product,
      price: Number(product.price),
      buyingPrice: Number(product.buyingPrice),
      transportationCost: Number(product.transportationCost),
      extraCost: Number(product.extraCost),
    });
  } catch {
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/admin/products/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      name,
      description,
      sku,
      price,
      buyingPrice,
      transportationCost,
      extraCost,
      stockQuantity,
      reorderLevel,
      unit,
      imageUrl,
      categoryId,
      inStock,
      featured,
    } = req.body;
    const resolvedCategoryId = Number(categoryId) > 0 ? Number(categoryId) : await getOrCreateDefaultCategoryId();
    const [product] = await db
      .update(productsTable)
      .set({
        name,
        description,
        sku,
        price: price.toString(),
        buyingPrice: (buyingPrice ?? 0).toString(),
        transportationCost: (transportationCost ?? 0).toString(),
        extraCost: (extraCost ?? 0).toString(),
        stockQuantity: stockQuantity ?? 0,
        reorderLevel: reorderLevel ?? 0,
        unit,
        imageUrl,
        categoryId: resolvedCategoryId,
        inStock,
        featured,
      })
      .where(eq(productsTable.id, id))
      .returning();
    res.json({
      ...product,
      price: Number(product.price),
      buyingPrice: Number(product.buyingPrice),
      transportationCost: Number(product.transportationCost),
      extraCost: Number(product.extraCost),
    });
  } catch {
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/admin/products/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ message: "Product deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

router.get("/admin/orders", authMiddleware, async (_req, res) => {
  try {
    const orders = await db.select().from(ordersTable).orderBy(ordersTable.createdAt);
    res.json(orders.map(o => ({ ...o, totalAmount: Number(o.totalAmount) })));
  } catch {
    res.status(500).json({ error: "Failed to get orders" });
  }
});

// Get single order for editing
router.get("/admin/orders/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid order ID" });
  }
  try {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      ...order,
      totalAmount: Number(order.totalAmount || 0),
    });
  } catch (err) {
    console.error("Failed to fetch order:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// Update order details
router.put("/admin/orders/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  const { customerPhone, customerEmail, deliveryAddress, notes, paymentMethod, paymentStatus, amountPaid } = req.body;

  try {
    const updated = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id))
        .limit(1);

      if (!order) {
        throw new Error("Order not found");
      }

      // The received amount is the source of truth for payment status: an
      // explicit amountPaid derives paid/partial/unpaid, while a bare
      // status change keeps the amount consistent with it.
      const totalAmount = Number(order.totalAmount || 0);
      let nextAmountPaid = Number(order.amountPaid ?? 0);
      let nextPaymentStatus = paymentStatus ?? order.paymentStatus;

      if (amountPaid !== undefined && amountPaid !== null && amountPaid !== "") {
        const parsedPaid = Number(amountPaid);
        if (!Number.isFinite(parsedPaid) || parsedPaid < 0) {
          throw new Error("INVALID_AMOUNT_PAID");
        }
        nextAmountPaid = Math.min(parsedPaid, totalAmount);
        nextPaymentStatus =
          nextAmountPaid >= totalAmount && totalAmount > 0
            ? "paid"
            : nextAmountPaid > 0
              ? "partial"
              : "unpaid";
      } else if (paymentStatus === "paid") {
        nextAmountPaid = totalAmount;
      } else if (paymentStatus === "unpaid") {
        nextAmountPaid = 0;
      }

      const updates = {
        customerPhone: customerPhone ?? order.customerPhone,
        customerEmail: customerEmail ?? order.customerEmail,
        customerAddress: deliveryAddress ?? order.customerAddress,
        notes: notes ?? order.notes,
        paymentMethod: paymentMethod ?? order.paymentMethod,
        paymentStatus: nextPaymentStatus,
        amountPaid: nextAmountPaid.toFixed(2),
      };

      const [updatedOrder] = await tx
        .update(ordersTable)
        .set(updates)
        .where(eq(ordersTable.id, id))
        .returning();

      await logAuditEntry(
        tx,
        createAuditEntry({
          entityType: "order",
          entityId: id,
          action: "update",
          oldValues: {
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
            deliveryAddress: order.customerAddress,
            notes: order.notes,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
          },
          newValues: updates,
          metadata: {
            endpoint: "PUT /admin/orders/:id",
            ip: (req as any).ip,
            timestamp: new Date().toISOString(),
          },
        })
      );

      return updatedOrder;
    });

    res.json({
      ...updated,
      totalAmount: Number(updated.totalAmount || 0),
      amountPaid: Number((updated as any).amountPaid || 0),
    });
  } catch (err) {
    const errMessage = (err as any)?.message || String(err);
    if (errMessage === "INVALID_AMOUNT_PAID") {
      return res.status(400).json({ error: "Amount paid must be zero or a positive number" });
    }
    console.error("Failed to update order:", err);
    res.status(errMessage === "Order not found" ? 404 : 500).json({
      error: "Failed to update order",
      details: errMessage,
    });
  }
});

const ALLOWED_ORDER_STATUSES = ["order-received", "confirmed", "preparing", "dispatched", "delivered", "cancelled"] as const;
const ALLOWED_PAYMENT_STATUSES = ["paid", "unpaid"] as const;

router.put("/admin/orders/:id/status", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid order ID" });
  }
  const { status, paymentStatus } = req.body;
  if (!ALLOWED_ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${ALLOWED_ORDER_STATUSES.join(", ")}`,
    });
  }
  if (paymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
    return res.status(400).json({
      error: `Invalid payment status. Must be one of: ${ALLOWED_PAYMENT_STATUSES.join(", ")}`,
    });
  }
  try {
    const [order] = await db
      .update(ordersTable)
      .set({
        status,
        ...(paymentStatus ? { paymentStatus } : {}),
        // Keep the received amount in step with a quick paid/unpaid toggle so
        // the two can never contradict each other.
        ...(paymentStatus === "paid" ? { amountPaid: sql`${ordersTable.totalAmount}` } : {}),
        ...(paymentStatus === "unpaid" ? { amountPaid: "0.00" } : {}),
      })
      .where(eq(ordersTable.id, id))
      .returning();

    res.json({ ...order, totalAmount: Number(order.totalAmount) });
  } catch {
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// Settle an online order: confirm real payment received, or add unpaid amount to customer credit tab
router.post("/admin/orders/:id/settle", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  const { action, paymentMethod } = req.body ?? {};
  if (!["confirmed", "credit"].includes(action)) {
    return res.status(400).json({ error: "action must be 'confirmed' or 'credit'" });
  }
  if (!["cash", "esewa", "khalti", "bank"].includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod must be cash, esewa, khalti, or bank" });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id))
        .limit(1);

      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (action === "confirmed" && order.paymentStatus === "paid") throw new Error("ALREADY_PAID");

      const customerId = order.customerId;
      if (!customerId) throw new Error("NO_CUSTOMER");

      const [customer] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, customerId))
        .limit(1);

      if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

      const totalAmount = Number(order.totalAmount);
      const currentBalance = Number(customer.creditBalance ?? 0);

      if (action === "confirmed") {
        // Mark order paid and delivered (fully settled — move off active list)
        await tx
          .update(ordersTable)
          .set({ paymentStatus: "paid", status: "delivered" })
          .where(eq(ordersTable.id, id));

        // Record the incoming payment
        const [payment] = await tx
          .insert(customerPaymentsTable)
          .values({
            customerId: customer.id,
            amount: totalAmount.toFixed(2),
            paymentMethod,
            referenceNote: `Online order #${order.id} — ${paymentMethod} payment confirmed`,
          })
          .returning();

        // Ledger entry: credit side (money received, balance unchanged)
        await tx.insert(customerLedgerTable).values({
          customerId: customer.id,
          paymentId: payment.id,
          entryType: "payment",
          description: `Online order #${order.id} — ${paymentMethod} payment confirmed`,
          debitAmount: "0.00",
          creditAmount: totalAmount.toFixed(2),
          balanceAfter: currentBalance.toFixed(2),
          metadata: { source: "order-payment-confirm", orderId: order.id, paymentMethod },
        });
      } else {
        // Move to credit: customer owes this amount — also mark order as delivered so it leaves active list
        const newBalance = currentBalance + totalAmount;

        await tx
          .update(ordersTable)
          .set({ status: "delivered" })
          .where(eq(ordersTable.id, id));

        await tx
          .update(customersTable)
          .set({
            creditBalance: newBalance.toFixed(2),
            updatedAt: new Date(),
          } as any)
          .where(eq(customersTable.id, customer.id));

        // Ledger entry: debit side (debt added to account)
        await tx.insert(customerLedgerTable).values({
          customerId: customer.id,
          entryType: "order-credit",
          description: `Online order #${order.id} — added to credit tab`,
          debitAmount: totalAmount.toFixed(2),
          creditAmount: "0.00",
          balanceAfter: newBalance.toFixed(2),
          metadata: { source: "order-credit", orderId: order.id, originalPaymentMethod: order.paymentMethod },
        });
      }

      return { success: true, action, orderId: id };
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "ORDER_NOT_FOUND") return res.status(404).json({ error: "Order not found" });
    if (message === "ALREADY_PAID") return res.status(400).json({ error: "Order is already marked as paid" });
    if (message === "NO_CUSTOMER") return res.status(400).json({ error: "This order has no linked customer record" });
    if (message === "CUSTOMER_NOT_FOUND") return res.status(404).json({ error: "Customer not found" });
    res.status(500).json({ error: "Failed to settle order" });
  }
});

router.get("/admin/bookings", authMiddleware, async (_req, res) => {
  try {
    const bookings = await db.select().from(bookingsTable).orderBy(bookingsTable.createdAt);
    res.json(bookings);
  } catch {
    res.status(500).json({ error: "Failed to get bookings" });
  }
});

// Get single booking for editing
router.get("/admin/bookings/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }
  try {
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json(booking);
  } catch (err) {
    console.error("Failed to fetch booking:", err);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// Update booking details
router.put("/admin/bookings/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  const {
    customerPhone,
    pickupLocation,
    destination,
    bookingDate,
    notes,
    serviceType,
    chargedAmount,
    amountPaid,
    paymentMethod,
    proofPath,
  } = req.body;

  try {
    const updated = await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, id))
        .limit(1);

      if (!booking) {
        throw new Error("Booking not found");
      }

      const updates = {
        customerPhone: customerPhone ?? booking.customerPhone,
        pickupLocation: pickupLocation ?? booking.pickupLocation,
        destination: destination ?? booking.destination,
        bookingDate: bookingDate ? String(bookingDate) : booking.bookingDate,
        notes: notes ?? booking.notes,
        serviceType: serviceType ?? booking.serviceType,
        chargedAmount: chargedAmount !== undefined ? chargedAmount : booking.chargedAmount,
        amountPaid: amountPaid !== undefined ? amountPaid : booking.amountPaid,
        paymentMethod: paymentMethod ?? booking.paymentMethod,
        proofPath: typeof proofPath === "string" ? proofPath.trim() || null : (booking as any).proofPath,
      } as Record<string, any>;

      const nextCharged = Number(updates.chargedAmount ?? 0);
      const nextPaid = Number(updates.amountPaid ?? 0);
      updates.paymentStatus = nextPaid <= 0 ? "unpaid" : nextPaid >= nextCharged ? "paid" : "partial";

      const oldDue = bookingDue(booking);
      const candidateBooking = { ...booking, ...updates };
      const customer = await findOrCreateCustomerForBooking(tx, candidateBooking);
      updates.customerId = customer.id;

      const [updatedBooking] = await tx
        .update(bookingsTable)
        .set(updates)
        .where(eq(bookingsTable.id, id))
        .returning();

      const newDue = bookingDue(updatedBooking);
      const spentDelta = Math.max(0, Number(updatedBooking.chargedAmount || 0) - Number(booking.chargedAmount || 0));

      if (booking.customerId && booking.customerId !== customer.id) {
        const [oldCustomer] = await tx
          .select()
          .from(customersTable)
          .where(eq(customersTable.id, booking.customerId))
          .limit(1);

        if (oldCustomer) {
          await tx
            .update(customersTable)
            .set({
              creditBalance: Math.max(0, Number(oldCustomer.creditBalance ?? 0) - oldDue).toFixed(2),
              updatedAt: new Date(),
            } as any)
            .where(eq(customersTable.id, oldCustomer.id));
        }
      }

      const creditDelta = booking.customerId && booking.customerId !== customer.id ? newDue : newDue - oldDue;
      const newCustomerBalance = Math.max(0, Number(customer.creditBalance ?? 0) + creditDelta);

      await tx
        .update(customersTable)
        .set({
          creditBalance: newCustomerBalance.toFixed(2),
          totalSpent: (Number(customer.totalSpent ?? 0) + spentDelta).toFixed(2),
          updatedAt: new Date(),
        } as any)
        .where(eq(customersTable.id, customer.id));

      await logAuditEntry(
        tx,
        createAuditEntry({
          entityType: "booking",
          entityId: id,
          action: "update",
          oldValues: {
            customerPhone: booking.customerPhone,
            pickupLocation: booking.pickupLocation,
            destination: booking.destination,
            bookingDate: booking.bookingDate,
            notes: booking.notes,
            serviceType: booking.serviceType,
            chargedAmount: booking.chargedAmount,
            amountPaid: booking.amountPaid,
            paymentMethod: booking.paymentMethod,
            proofPath: (booking as any).proofPath,
          },
          newValues: updates,
          metadata: {
            endpoint: "PUT /admin/bookings/:id",
            ip: (req as any).ip,
            timestamp: new Date().toISOString(),
          },
        })
      );

      await tx.insert(customerLedgerTable).values({
        customerId: customer.id,
        entryType: creditDelta >= 0 ? "transport_edit_charge" : "transport_edit_payment",
        description: `Transport booking #${updatedBooking.id} edited`,
        debitAmount: creditDelta > 0 ? creditDelta.toFixed(2) : "0.00",
        creditAmount: creditDelta < 0 ? Math.abs(creditDelta).toFixed(2) : "0.00",
        balanceAfter: newCustomerBalance.toFixed(2),
        metadata: {
          bookingId: updatedBooking.id,
          serviceType: updatedBooking.serviceType,
          pickupLocation: updatedBooking.pickupLocation,
          destination: updatedBooking.destination,
          chargedAmount: Number(updatedBooking.chargedAmount || 0),
          amountPaid: Number(updatedBooking.amountPaid || 0),
          paymentMethod: updatedBooking.paymentMethod,
          paymentStatus: updatedBooking.paymentStatus,
          proofPath: (updatedBooking as any).proofPath || null,
        },
      });

      return updatedBooking;
    });

    res.json(updated);
  } catch (err) {
    const errMessage = (err as any)?.message || String(err);
    console.error("Failed to update booking:", err);
    res.status(errMessage === "Booking not found" ? 404 : 500).json({
      error: "Failed to update booking",
      details: errMessage,
    });
  }
});

router.put("/admin/bookings/:id/status", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const { status, chargedAmount, amountPaid, paymentMethod, paymentStatus, addToCredit, proofPath } = req.body ?? {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  if (typeof status !== "string" || status.trim().length === 0) {
    return res.status(400).json({ error: "Booking status is required" });
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [booking] = await tx
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, id))
        .limit(1);

      if (!booking) throw new Error("BOOKING_NOT_FOUND");

      const customer = await findOrCreateCustomerForBooking(tx, booking);
      const oldDue = bookingDue(booking);
      const nextCharged = Number(chargedAmount ?? booking.chargedAmount ?? 0);
      const nextPaid = addToCredit ? 0 : Number(amountPaid ?? booking.amountPaid ?? 0);

      const updates: Record<string, any> = {
        status: addToCredit ? "completed" : status.trim(),
        customerId: customer.id,
      };

      if (chargedAmount !== undefined || addToCredit) updates.chargedAmount = nextCharged.toFixed(2);
      if (amountPaid !== undefined || addToCredit) updates.amountPaid = nextPaid.toFixed(2);
      if (paymentMethod !== undefined || addToCredit) updates.paymentMethod = paymentMethod || booking.paymentMethod;
      if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
      if (typeof proofPath === "string") updates.proofPath = proofPath.trim() || null;

      if (updates.chargedAmount !== undefined && updates.amountPaid !== undefined && paymentStatus === undefined) {
        const charged = Number(updates.chargedAmount);
        const paid = Number(updates.amountPaid);
        updates.paymentStatus = paid <= 0 ? "unpaid" : paid >= charged ? "paid" : "partial";
      }

      const [updatedBooking] = await tx
        .update(bookingsTable)
        .set(updates as any)
        .where(eq(bookingsTable.id, id))
        .returning();

      const newDue = bookingDue(updatedBooking);
      const creditDelta = newDue - oldDue;
      const spentDelta = Math.max(0, Number(updatedBooking.chargedAmount || 0) - Number(booking.chargedAmount || 0));
      const newCustomerBalance = Math.max(0, Number(customer.creditBalance ?? 0) + creditDelta);

      await tx
        .update(customersTable)
        .set({
          creditBalance: newCustomerBalance.toFixed(2),
          totalSpent: (Number(customer.totalSpent ?? 0) + spentDelta).toFixed(2),
          updatedAt: new Date(),
        } as any)
        .where(eq(customersTable.id, customer.id));

      await tx.insert(customerLedgerTable).values({
        customerId: customer.id,
        entryType: creditDelta >= 0 ? "transport_charge" : "transport_payment",
        description: `Transport booking #${updatedBooking.id} ${updates.status}`,
        debitAmount: creditDelta > 0 ? creditDelta.toFixed(2) : "0.00",
        creditAmount: creditDelta < 0 ? Math.abs(creditDelta).toFixed(2) : "0.00",
        balanceAfter: newCustomerBalance.toFixed(2),
        metadata: {
          bookingId: updatedBooking.id,
          serviceType: updatedBooking.serviceType,
          pickupLocation: updatedBooking.pickupLocation,
          destination: updatedBooking.destination,
          chargedAmount: Number(updatedBooking.chargedAmount || 0),
          amountPaid: Number(updatedBooking.amountPaid || 0),
          paymentMethod: updatedBooking.paymentMethod,
          paymentStatus: updatedBooking.paymentStatus,
          proofPath: (updatedBooking as any).proofPath || null,
        },
      });

      return updatedBooking;
    });

    return res.json({
      ...updated,
      chargedAmount: Number(updated.chargedAmount ?? 0),
      amountPaid: Number(updated.amountPaid ?? 0),
    });
  } catch (err) {
    console.error("Booking update error:", err);
    const message = err instanceof Error ? err.message : "";
    res.status(message === "BOOKING_NOT_FOUND" ? 404 : 500).json({ error: "Failed to update booking status" });
  }
});

// ── Analytics: combined shop + transport totals for a date range ──────────────
router.get("/admin/analytics", authMiddleware, async (req, res) => {
  const {
    period = "month",
    date,
    startDate: startDateParam,
    endDate: endDateParam,
    type = "all",
  } = req.query as {
    period?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
  };

  let startDate: Date;
  let endDate: Date;

  // Build date range
  if (startDateParam && endDateParam) {
    // Custom date range provided
    startDate = new Date(startDateParam);
    endDate = new Date(endDateParam);
    endDate.setDate(endDate.getDate() + 1); // Include end date
  } else {
    const refDate = date ? new Date(date) : new Date();

    if (period === "yearly" || period === "year") {
      startDate = new Date(refDate.getFullYear(), 0, 1);
      endDate = new Date(refDate.getFullYear() + 1, 0, 1);
    } else if (period === "monthly" || period === "month") {
      startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      endDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
    } else if (period === "weekly" || period === "week") {
      const dayOfWeek = refDate.getDay();
      const diff = refDate.getDate() - dayOfWeek;
      startDate = new Date(refDate.setDate(diff));
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
    } else {
      // daily / day
      startDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
      endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + 1);
    }
  }

  try {
    const sqlRaw = sql;

    // Fetch shop invoices
    let invoicesData: any[] = [];
    if (type === "all" || type === "invoices" || type === "shop") {
      invoicesData = await db
        .select({
          id: invoicesTable.id,
          customerId: invoicesTable.customerId,
          invoiceNumber: invoicesTable.invoiceNumber,
          totalAmount: invoicesTable.totalAmount,
          amountPaid: invoicesTable.amountPaid,
          dueAmount: invoicesTable.dueAmount,
          paymentStatus: invoicesTable.paymentStatus,
          paymentMethod: invoicesTable.paymentMethod,
          createdAt: invoicesTable.createdAt,
          customerName: customersTable.name,
        })
        .from(invoicesTable)
        .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
        .where(
          sqlRaw`${invoicesTable.createdAt} >= ${startDate} AND ${invoicesTable.createdAt} < ${endDate} AND ${invoicesTable.voidedAt} is null`
        );
    }

    // Fetch orders
    let ordersData: any[] = [];
    if (type === "all" || type === "orders") {
      ordersData = await db
        .select({
          id: ordersTable.id,
          customerId: ordersTable.customerId,
          totalAmount: ordersTable.totalAmount,
          paymentStatus: ordersTable.paymentStatus,
          paymentMethod: ordersTable.paymentMethod,
          createdAt: ordersTable.createdAt,
          customerName: customersTable.name,
        })
        .from(ordersTable)
        .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
        .where(
          sqlRaw`${ordersTable.createdAt} >= ${startDate} AND ${ordersTable.createdAt} < ${endDate}`
        );
    }

    // Fetch bookings
    let bookingsData: any[] = [];
    if (type === "all" || type === "bookings") {
      bookingsData = await db
        .select({
          id: bookingsTable.id,
          customerId: bookingsTable.customerId,
          chargedAmount: bookingsTable.chargedAmount,
          amountPaid: bookingsTable.amountPaid,
          paymentStatus: bookingsTable.paymentStatus,
          paymentMethod: bookingsTable.paymentMethod,
          createdAt: bookingsTable.createdAt,
          customerName: customersTable.name,
        })
        .from(bookingsTable)
        .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
        .where(
          sqlRaw`${bookingsTable.createdAt} >= ${startDate} AND ${bookingsTable.createdAt} < ${endDate}`
        );
    }

    // Fetch payments
    let paymentsData: any[] = [];
    if (type === "all" || type === "payments") {
      paymentsData = await db
        .select({
          id: customerPaymentsTable.id,
          customerId: customerPaymentsTable.customerId,
          amount: customerPaymentsTable.amount,
          paymentDate: customerPaymentsTable.createdAt,
          paymentMethod: customerPaymentsTable.paymentMethod,
          customerName: customersTable.name,
        })
        .from(customerPaymentsTable)
        .leftJoin(customersTable, eq(customerPaymentsTable.customerId, customersTable.id))
        .where(
          sqlRaw`${customerPaymentsTable.createdAt} >= ${startDate} AND ${customerPaymentsTable.createdAt} < ${endDate} AND ${customerPaymentsTable.voidedAt} is null`
        );
    }

    const [currentCustomerCredit] = await db
      .select({
        totalCredit: sql<string>`coalesce(sum(${customersTable.creditBalance}), 0)`,
      })
      .from(customersTable);
    const currentCustomerCreditDue = Number(currentCustomerCredit?.totalCredit ?? 0);

    const dealerEntries = await db
      .select({
        transactionType: stockLedgerTable.transactionType,
        metadata: stockLedgerTable.metadata,
      })
      .from(stockLedgerTable);
    const currentDealerTotals = summarizeDealerEntries(dealerEntries);

    const periodDealerEntries = await db
      .select({
        transactionType: stockLedgerTable.transactionType,
        metadata: stockLedgerTable.metadata,
      })
      .from(stockLedgerTable)
      .where(sqlRaw`${stockLedgerTable.createdAt} >= ${startDate} AND ${stockLedgerTable.createdAt} < ${endDate}`);
    const periodDealerTotals = summarizeDealerEntries(periodDealerEntries);

    // Format transactions
    const transactions = [
      ...invoicesData.map((invoice: any) => ({
        type: "invoice",
        id: invoice.id,
        customerId: invoice.customerId,
        customerName: invoice.customerName || "Unknown",
        date: invoice.createdAt,
        amount: Number(invoice.totalAmount || 0),
        amountPaid: Number(invoice.amountPaid || 0),
        creditAmount: Number(invoice.dueAmount || 0),
        paymentMethod: invoice.paymentMethod,
        paymentStatus: invoice.paymentStatus,
        reference: invoice.invoiceNumber,
      })),
      ...ordersData.map((order: any) => ({
        type: "order",
        id: order.id,
        customerId: order.customerId,
        customerName: order.customerName || "Unknown",
        date: order.createdAt,
        amount: Number(order.totalAmount || 0),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
      })),
      ...bookingsData.map((booking: any) => ({
        type: "booking",
        id: booking.id,
        customerId: booking.customerId,
        customerName: booking.customerName || "Unknown",
        date: booking.createdAt,
        amount: Number(booking.chargedAmount || 0),
        amountPaid: Number(booking.amountPaid || 0),
        creditAmount: Math.max(0, Number(booking.chargedAmount || 0) - Number(booking.amountPaid || 0)),
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
      })),
      ...paymentsData.map((payment: any) => ({
        type: "payment",
        id: payment.id,
        customerId: payment.customerId,
        customerName: payment.customerName || "Unknown",
        date: payment.paymentDate,
        amount: Number(payment.amount || 0),
        paymentMethod: payment.paymentMethod,
        paymentStatus: "paid",
      })),
    ].sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Calculate summary
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalInvoices = invoicesData.length;
    const totalInvoiceAmount = invoicesData.reduce(
      (sum: number, invoice: any) => sum + Number(invoice.totalAmount || 0),
      0
    );
    const totalInvoicePaid = invoicesData.reduce(
      (sum: number, invoice: any) => sum + Number(invoice.amountPaid || 0),
      0
    );
    const totalInvoiceCredit = invoicesData.reduce(
      (sum: number, invoice: any) => sum + Number(invoice.dueAmount || 0),
      0
    );
    const totalOrders = ordersData.length;
    const totalOrderAmount = ordersData.reduce(
      (sum: number, o: any) => sum + Number(o.totalAmount || 0),
      0
    );
    const totalBookings = bookingsData.length;
    const totalBookingAmount = bookingsData.reduce(
      (sum: number, b: any) => sum + Number(b.chargedAmount || 0),
      0
    );
    const totalBookingPaid = bookingsData.reduce(
      (sum: number, b: any) => sum + Number(b.amountPaid || 0),
      0
    );
    const totalBookingCredit = bookingsData.reduce(
      (sum: number, b: any) => sum + Math.max(0, Number(b.chargedAmount || 0) - Number(b.amountPaid || 0)),
      0
    );
    const totalPaymentsMade = paymentsData.reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0
    );
    const shop = {
      invoiceCount: totalInvoices,
      totalBilled: totalInvoiceAmount,
      totalCollected: totalInvoicePaid,
      totalCredit: totalInvoiceCredit,
    };
    const transport = {
      bookingCount: totalBookings,
      totalBilled: totalBookingAmount,
      totalCollected: totalBookingPaid,
      totalCredit: totalBookingCredit,
    };
    const combined = {
      totalBilled: shop.totalBilled + transport.totalBilled,
      totalCollected: shop.totalCollected + transport.totalCollected + totalPaymentsMade,
      totalCredit: currentCustomerCreditDue,
      rawRecordCredit: shop.totalCredit + transport.totalCredit,
    };

    res.json({
      period,
      type,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      transactions,
      combined,
      shop,
      transport,
      dealer: {
        ...periodDealerTotals,
        currentDue: currentDealerTotals.totalDue,
        netCreditPosition: currentCustomerCreditDue - currentDealerTotals.totalDue,
      },
      summary: {
        totalAmount,
        totalInvoices,
        totalInvoiceAmount,
        totalInvoicePaid,
        totalInvoiceCredit,
        totalOrders,
        totalOrderAmount,
        totalBookings,
        totalBookingAmount,
        totalBookingPaid,
        totalBookingCredit,
        totalPaymentsMade,
        totalBilled: combined.totalBilled,
        totalCollected: combined.totalCollected,
        totalCredit: combined.totalCredit,
        rawRecordCredit: combined.rawRecordCredit,
        currentCustomerCreditDue,
        dealerCount: periodDealerTotals.dealerCount,
        dealerTotalBilled: periodDealerTotals.totalBilled,
        dealerTotalPaid: periodDealerTotals.totalPaid,
        dealerTotalDue: periodDealerTotals.totalDue,
        dealerCurrentDue: currentDealerTotals.totalDue,
        dealerReturnCount: periodDealerTotals.returnCount,
        dealerDamagedCount: periodDealerTotals.damagedCount,
        netCreditPosition: currentCustomerCreditDue - currentDealerTotals.totalDue,
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({
      error: "Failed to load analytics",
      details: (err as any)?.message || String(err),
    });
  }
});

router.put("/admin/settings", authMiddleware, async (req, res) => {
  try {
    const settings = req.body;
    const existing = await getSettings();
    if (existing) {
      const [updated] = await db
        .update(settingsTable)
        .set(settings)
        .where(eq(settingsTable.id, existing.id))
        .returning();
      invalidateWhatsAppCache();
      return res.json(updated);
    }
    const [created] = await db.insert(settingsTable).values(settings).returning();
    invalidateWhatsAppCache();
    res.json(created);
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Get audit logs
router.get("/admin/audit-logs", authMiddleware, async (req, res) => {
  try {
    const { entityType, entityId, limit = 50, offset = 0 } = req.query;
    const conditions: any[] = [];

    if (entityType) {
      conditions.push(eq(auditLogsTable.entityType, String(entityType)));
    }
    if (entityId) {
      conditions.push(eq(auditLogsTable.entityId, Number(entityId)));
    }

    const logs = await db
      .select()
      .from(auditLogsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json(logs);
  } catch (err) {
    console.error("Failed to fetch audit logs:", err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.put("/admin/products/:id/adjust-stock", authMiddleware, async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const {
      quantity,
      reason,
      transactionType,
      dealerName,
      dealerPhone,
      billNumber,
      billAmount,
      paidAmount,
      proofPath,
      returnStatus,
      damagedReason,
    } = req.body;

    if (isNaN(productId) || productId <= 0) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    if (!Number.isInteger(quantity) || quantity === 0) {
      return res.status(400).json({ error: "Quantity must be a non-zero integer" });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return res.status(400).json({ error: "Reason is required" });
    }

    const result = await db.transaction(async (tx) => {
      // Lock the product row so a concurrent adjustment can't read the same
      // starting balance and silently overwrite this one.
      const [product] = await tx
        .select({ stockQuantity: productsTable.stockQuantity })
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .for("update");

      if (!product) {
        throw new Error("Product not found");
      }

      const balanceBefore = product.stockQuantity || 0;
      const balanceAfter = Math.max(balanceBefore + quantity, 0);
      const adjustedQuantity = balanceAfter - balanceBefore;

      await tx
        .update(productsTable)
        .set({
          stockQuantity: balanceAfter,
          inStock: balanceAfter > 0,
        })
        .where(eq(productsTable.id, productId));

      const requestedType = typeof transactionType === "string" ? transactionType.trim().toLowerCase() : "";
      const ledgerType =
        requestedType ||
        (quantity > 0 ? "purchase" : reason.toLowerCase().includes("damage") ? "damaged" : reason.toLowerCase().includes("return") ? "return" : "adjustment");
      const dealerBill = Number(billAmount ?? 0);
      const dealerPaid = Number(paidAmount ?? 0);

      await tx.insert(stockLedgerTable).values({
        productId,
        transactionType: ledgerType,
        quantity: adjustedQuantity,
        reason: reason.trim(),
        balanceBefore,
        balanceAfter,
        metadata: {
          adjustmentType: quantity > 0 ? "stock-in" : "stock-out",
          requestedQuantity: quantity,
          dealerName: typeof dealerName === "string" ? dealerName.trim() || null : null,
          dealerPhone: typeof dealerPhone === "string" ? dealerPhone.trim() || null : null,
          billNumber: typeof billNumber === "string" ? billNumber.trim() || null : null,
          billAmount: dealerBill,
          paidAmount: dealerPaid,
          dealerDue: Math.max(0, dealerBill - dealerPaid),
          proofPath: typeof proofPath === "string" ? proofPath.trim() || null : null,
          returnStatus: typeof returnStatus === "string" ? returnStatus.trim() || null : null,
          damagedReason: typeof damagedReason === "string" ? damagedReason.trim() || null : null,
        },
      });

      return { productId, balanceBefore, balanceAfter };
    });

    res.json({
      success: true,
      productId: result.productId,
      balanceBefore: result.balanceBefore,
      balanceAfter: result.balanceAfter,
      message: "Stock adjusted successfully",
    });
  } catch (err) {
    console.error("Stock adjustment error:", err);
    res.status(500).json({
      error: "Failed to adjust stock",
      details: (err as any)?.message || String(err),
    });
  }
});

// One-time "go live" reset: wipes every test/demo record (customers, orders,
// bookings, invoices, payments, ledgers, rewards, stock history, dealer/stock
// entries, audit logs, product catalog, categories) while keeping shop
// settings and the admin login intact. A backup is taken first so it can be
// restored via /admin/backup if anything was cleared by mistake.
const FACTORY_RESET_CONFIRMATION = "DELETE ALL DATA";

router.post("/admin/factory-reset", authMiddleware, async (req, res) => {
  try {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const confirmation =
      typeof req.body?.confirmation === "string" ? req.body.confirmation.trim() : "";

    if (confirmation !== FACTORY_RESET_CONFIRMATION) {
      return res.status(400).json({
        error: `Type "${FACTORY_RESET_CONFIRMATION}" exactly to confirm.`,
      });
    }

    const settings = await getSettings();
    const storedHash = settings?.adminPasswordHash ?? null;
    const validPassword = await isOwnerPasswordValid(password, storedHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Password is incorrect" });
    }

    let backupFile: string | null = null;
    try {
      const backup = await createJsonBackup();
      backupFile = backup.filename;
    } catch (err) {
      console.error("Factory reset: pre-reset backup failed", err);
      return res.status(500).json({
        error: "Could not create a safety backup, so the reset was cancelled. Nothing was deleted.",
        details: (err as any)?.message || String(err),
      });
    }

    const cleared = await db.transaction(async (tx) => {
      const counts: Record<string, number> = {};
      const wipe = async (label: string, table: any) => {
        const result = await tx.delete(table);
        counts[label] = Number((result as any)?.rowCount ?? 0);
      };

      // Children before parents to satisfy foreign key constraints.
      await wipe("customerLedgerEntries", customerLedgerTable);
      await wipe("rewardTransactions", rewardTransactionsTable);
      await wipe("invoiceItems", invoiceItemsTable);
      await wipe("customerPayments", customerPaymentsTable);
      await wipe("invoices", invoicesTable);
      await wipe("orders", ordersTable);
      await wipe("bookings", bookingsTable);
      await wipe("stockLedgerEntries", stockLedgerTable);
      await wipe("auditLogs", auditLogsTable);
      await wipe("telegramQueue", telegramQueueTable);
      await wipe("customers", customersTable);
      await wipe("products", productsTable);
      await wipe("categories", categoriesTable);

      return counts;
    });

    res.json({
      success: true,
      message: "Factory reset complete. Shop settings and your admin login were kept as-is.",
      backupFile,
      cleared,
    });
  } catch (err) {
    console.error("Factory reset error:", err);
    res.status(500).json({
      error: "Factory reset failed",
      details: (err as any)?.message || String(err),
    });
  }
});

router.post("/admin/backup/create", authMiddleware, async (req, res) => {
  try {
    const { format } = req.query;
    const backupFormat = format === "sql" ? "sql" : "json";

    let metadata;
    if (backupFormat === "sql") {
      metadata = await createSqlBackup();
    } else {
      metadata = await createJsonBackup();
    }

    res.json({
      success: true,
      message: `${backupFormat.toUpperCase()} backup created successfully`,
      backup: metadata,
    });
  } catch (err) {
    console.error("Backup creation error:", err);
    res.status(500).json({
      error: "Failed to create backup",
      details: (err as any)?.message || String(err),
    });
  }
});

router.get("/admin/backup/list", authMiddleware, async (req, res) => {
  try {
    const backups = await listLocalBackups();

    res.json({
      success: true,
      backups,
      total: backups.length,
    });
  } catch (err) {
    console.error("List backups error:", err);
    res.status(500).json({
      error: "Failed to list backups",
      details: (err as any)?.message || String(err),
    });
  }
});

router.get("/admin/backup/status", authMiddleware, async (req, res) => {
  try {
    const status = await getBackupStatus();

    res.json({
      success: true,
      status,
    });
  } catch (err) {
    console.error("Get backup status error:", err);
    res.status(500).json({
      error: "Failed to get backup status",
      details: (err as any)?.message || String(err),
    });
  }
});

router.get("/admin/backup/schedule/status", authMiddleware, async (_req, res) => {
  try {
    res.json({
      success: true,
      schedule: getScheduledBackupStatus(),
    });
  } catch (err) {
    console.error("Get scheduled backup status error:", err);
    res.status(500).json({
      error: "Failed to get scheduled backup status",
      details: (err as any)?.message || String(err),
    });
  }
});

router.post("/admin/backup/schedule/run-now", authMiddleware, async (_req, res) => {
  try {
    const schedule = await runScheduledBackup("manual");
    res.json({
      success: !schedule.lastError,
      schedule,
    });
  } catch (err) {
    console.error("Run scheduled backup error:", err);
    res.status(500).json({
      error: "Failed to run scheduled backup",
      details: (err as any)?.message || String(err),
    });
  }
});

router.get("/admin/backup/:filename/download", authMiddleware, async (req, res) => {
  try {
    const filename = path.basename(String(req.params.filename));
    if (!filename.startsWith("backup-") || (!filename.endsWith(".json.gz") && !filename.endsWith(".sql.gz"))) {
      return res.status(400).json({ error: "Invalid backup filename" });
    }

    const backupPath = path.resolve(process.cwd(), "backups", filename);
    const backupDir = path.resolve(process.cwd(), "backups");
    if (!backupPath.startsWith(backupDir) || !existsSync(backupPath)) {
      return res.status(404).json({ error: "Backup not found" });
    }

    res.download(backupPath, filename);
  } catch (err) {
    console.error("Download backup error:", err);
    res.status(500).json({
      error: "Failed to download backup",
      details: (err as any)?.message || String(err),
    });
  }
});

router.get("/admin/dealers", authMiddleware, async (_req, res) => {
  try {
    const entries = await db
      .select({
        id: stockLedgerTable.id,
        productId: stockLedgerTable.productId,
        productName: productsTable.name,
        transactionType: stockLedgerTable.transactionType,
        quantity: stockLedgerTable.quantity,
        reason: stockLedgerTable.reason,
        date: stockLedgerTable.createdAt,
        metadata: stockLedgerTable.metadata,
      })
      .from(stockLedgerTable)
      .leftJoin(productsTable, eq(stockLedgerTable.productId, productsTable.id))
      .orderBy(desc(stockLedgerTable.createdAt))
      .limit(500);

    const dealerMap = new Map<string, any>();

    for (const entry of entries) {
      const metadata = (entry.metadata || {}) as Record<string, any>;
      const dealerName = String(metadata.dealerName || "").trim();
      if (!dealerName) continue;

      const dealerPhone = String(metadata.dealerPhone || "").trim();
      const key = `${dealerName.toLowerCase()}|${dealerPhone}`;
      const billAmount = Number(metadata.billAmount || 0);
      const paidAmount = Number(metadata.paidAmount || 0);
      const dealerDue = Math.max(0, billAmount - paidAmount);
      const isPayment = String(entry.transactionType || "").toLowerCase() === "dealer_payment";
      const paymentAmount = isPayment ? paidAmount : 0;

      const dealer = dealerMap.get(key) ?? {
        name: dealerName,
        phone: dealerPhone,
        totalBilled: 0,
        totalPaid: 0,
        totalDue: 0,
        purchaseCount: 0,
        returnCount: 0,
        damagedCount: 0,
        lastActivity: entry.date,
        entries: [],
      };

      dealer.totalBilled += isPayment ? 0 : billAmount;
      dealer.totalPaid += isPayment ? paymentAmount : paidAmount;
      dealer.totalDue += isPayment ? -paymentAmount : dealerDue;
      dealer.purchaseCount += String(entry.transactionType || "").toLowerCase() === "purchase" ? 1 : 0;
      dealer.returnCount += String(entry.transactionType || "").toLowerCase().includes("return") ? 1 : 0;
      dealer.damagedCount += String(entry.transactionType || "").toLowerCase().includes("damage") ? 1 : 0;
      dealer.lastActivity = entry.date > dealer.lastActivity ? entry.date : dealer.lastActivity;
      dealer.entries.push({
        id: entry.id,
        productId: entry.productId,
        productName: entry.productName,
        transactionType: entry.transactionType,
        quantity: entry.quantity,
        reason: entry.reason,
        date: entry.date,
        billNumber: metadata.billNumber || null,
        billAmount,
        paidAmount: isPayment ? paymentAmount : paidAmount,
        dealerDue: isPayment ? 0 : dealerDue,
        returnStatus: metadata.returnStatus || null,
        damagedReason: metadata.damagedReason || null,
      });

      dealerMap.set(key, dealer);
    }

    const dealers = Array.from(dealerMap.values())
      .map((dealer) => ({
        ...dealer,
        totalDue: Math.max(0, dealer.totalDue),
      }))
      .sort((a, b) => b.totalDue - a.totalDue || new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

    res.json({
      dealers,
      totals: {
        dealerCount: dealers.length,
        totalBilled: dealers.reduce((sum, dealer) => sum + Number(dealer.totalBilled || 0), 0),
        totalPaid: dealers.reduce((sum, dealer) => sum + Number(dealer.totalPaid || 0), 0),
        totalDue: dealers.reduce((sum, dealer) => sum + Number(dealer.totalDue || 0), 0),
      },
    });
  } catch (err) {
    console.error("Failed to fetch dealer records:", err);
    res.status(500).json({ error: "Failed to fetch dealer records" });
  }
});

router.post("/admin/dealer-payments", authMiddleware, async (req, res) => {
  try {
    const productId = Number(req.body?.productId);
    const amount = Number(req.body?.amount);
    const dealerName = String(req.body?.dealerName || "").trim();
    const dealerPhone = String(req.body?.dealerPhone || "").trim();
    const note = String(req.body?.note || "Dealer payment").trim();
    const proofPath = typeof req.body?.proofPath === "string" ? req.body.proofPath.trim() : "";

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Product is required for dealer payment record" });
    }
    if (!dealerName) {
      return res.status(400).json({ error: "Dealer name is required" });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Payment amount must be greater than zero" });
    }

    const [product] = await db
      .select({ stockQuantity: productsTable.stockQuantity })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const [entry] = await db
      .insert(stockLedgerTable)
      .values({
        productId,
        transactionType: "dealer_payment",
        quantity: 0,
        reason: note,
        balanceBefore: product.stockQuantity || 0,
        balanceAfter: product.stockQuantity || 0,
        metadata: {
          adjustmentType: "dealer-payment",
          dealerName,
          dealerPhone: dealerPhone || null,
          billAmount: 0,
          paidAmount: amount,
          dealerDue: 0,
          note,
          proofPath: proofPath || null,
        },
      })
      .returning();

    res.status(201).json({ success: true, entry });
  } catch (err) {
    console.error("Failed to record dealer payment:", err);
    res.status(500).json({ error: "Failed to record dealer payment" });
  }
});

router.get("/admin/products/:id/stock-history", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid product ID" });
  }

  try {
    const history = await db
      .select({
        id: stockLedgerTable.id,
        date: stockLedgerTable.createdAt,
        quantity: stockLedgerTable.balanceAfter,
        change: stockLedgerTable.quantity,
        reason: stockLedgerTable.reason,
        transactionType: stockLedgerTable.transactionType,
        linkedEntityType: stockLedgerTable.linkedEntityType,
        linkedEntityId: stockLedgerTable.linkedEntityId,
        metadata: stockLedgerTable.metadata,
      })
      .from(stockLedgerTable)
      .where(eq(stockLedgerTable.productId, id))
      .orderBy(desc(stockLedgerTable.createdAt))
      .limit(100);

    res.json({ history });
  } catch (err) {
    console.error("Failed to fetch stock history:", err);
    res.status(500).json({ error: "Failed to fetch stock history" });
  }
});

router.delete("/admin/backup/:filename", authMiddleware, async (req, res) => {
  try {
    const filename = String(req.params.filename);

    await deleteLocalBackup(filename);

    res.json({
      success: true,
      message: "Backup deleted successfully",
      deleted: filename,
    });
  } catch (err) {
    console.error("Delete backup error:", err);
    res.status(500).json({
      error: "Failed to delete backup",
      details: (err as any)?.message || String(err),
    });
  }
});

router.post("/admin/backup/cleanup", authMiddleware, async (req, res) => {
  try {
    const { keepCount } = req.query;
    const count = keepCount ? Number(keepCount) : 30;

    const deleted = await cleanupOldBackups(count);

    res.json({
      success: true,
      message: `Cleanup completed. Deleted ${deleted} old backup(s). Keeping last ${count} backups.`,
      deleted,
    });
  } catch (err) {
    console.error("Backup cleanup error:", err);
    res.status(500).json({
      error: "Failed to cleanup backups",
      details: (err as any)?.message || String(err),
    });
  }
});

export default router;
