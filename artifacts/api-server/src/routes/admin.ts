import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  categoriesTable,
  ordersTable,
  bookingsTable,
  invoicesTable,
  settingsTable,
  customersTable,
  customerPaymentsTable,
  customerLedgerTable,
  auditLogsTable,
  stockLedgerTable,
} from "@workspace/db/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { generateSecret, generateURI, verifySync } from "otplib";
import { invalidateWhatsAppCache } from "../utils/whatsapp-service.js";
import { sendTelegramMessage } from "../utils/telegram-service.js";
import { z } from "zod";
import { ensureBootstrapData, getOrCreateDefaultCategoryId } from "../lib/bootstrap.js";
import { logAuditEntry, createAuditEntry } from "../lib/audit.js";
import { seedTestData, clearTestData, getTestDataStatus } from "../lib/test-data-seeder.js";
import {
  createJsonBackup,
  createSqlBackup,
  listLocalBackups,
  deleteLocalBackup,
  getBackupStatus,
  cleanupOldBackups,
} from "../lib/backup.js";

const scryptAsync = promisify(scrypt);
const router: IRouter = Router();

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "rajesh-shopping-secret-2024";
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

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
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

  const settings = await getSettings();

  if (!matchesIdentifier(identifier, settings)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const storedHash = settings?.adminPasswordHash ?? null;
  const passwordOk = await isOwnerPasswordValid(password, storedHash);

  if (!passwordOk) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

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

  const settings = await getSettings();

  if (!matchesIdentifier(identifier, settings)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const storedHash = settings?.adminPasswordHash ?? null;
  const passwordOk = await isOwnerPasswordValid(password, storedHash);

  if (!passwordOk) {
    return res.status(401).json({ error: "Invalid credentials" });
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
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, message: "Login successful" });
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

  const { customerPhone, customerEmail, deliveryAddress, notes, paymentMethod, paymentStatus } = req.body;

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

      const updates = {
        customerPhone: customerPhone ?? order.customerPhone,
        customerEmail: customerEmail ?? order.customerEmail,
        customerAddress: deliveryAddress ?? order.customerAddress,
        notes: notes ?? order.notes,
        paymentMethod: paymentMethod ?? order.paymentMethod,
        paymentStatus: paymentStatus ?? order.paymentStatus,
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
    });
  } catch (err) {
    const errMessage = (err as any)?.message || String(err);
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
      .set({ status, ...(paymentStatus ? { paymentStatus } : {}) })
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
        bookingDate: bookingDate ? new Date(bookingDate) : booking.bookingDate,
        notes: notes ?? booking.notes,
        serviceType: serviceType ?? booking.serviceType,
        chargedAmount: chargedAmount !== undefined ? chargedAmount : booking.chargedAmount,
        amountPaid: amountPaid !== undefined ? amountPaid : booking.amountPaid,
        paymentMethod: paymentMethod ?? booking.paymentMethod,
      };

      const [updatedBooking] = await tx
        .update(bookingsTable)
        .set(updates)
        .where(eq(bookingsTable.id, id))
        .returning();

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
          },
          newValues: updates,
          metadata: {
            endpoint: "PUT /admin/bookings/:id",
            ip: (req as any).ip,
            timestamp: new Date().toISOString(),
          },
        })
      );

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
  const { status, chargedAmount, amountPaid, paymentMethod, paymentStatus, addToCredit } = req.body ?? {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid booking ID" });
  }

  if (typeof status !== "string" || status.trim().length === 0) {
    return res.status(400).json({ error: "Booking status is required" });
  }

  try {
    // If adding to credit, fetch booking first to get customer ID
    if (addToCredit) {
      const [booking] = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, id))
        .limit(1);

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Use transaction to atomically update booking and customer credit
      await db.transaction(async (tx) => {
        const chargedAmt = Number(chargedAmount ?? booking.chargedAmount ?? 0);

        // Update booking status to completed and mark as delivered
        await tx
          .update(bookingsTable)
          .set({
            status: "completed",
            chargedAmount: chargedAmt.toFixed(2),
            amountPaid: "0",
            paymentStatus: "unpaid",
            paymentMethod: paymentMethod || booking.paymentMethod,
          } as any)
          .where(eq(bookingsTable.id, id));

        // Find customer by phone number (booking might not have explicit customer ID)
        const customers = await tx.select().from(customersTable);
        const customer = customers.find((c: any) =>
          c.phone && c.phone.replace(/[^\d+]/g, "") === booking.customerPhone.replace(/[^\d+]/g, "")
        );

        if (customer) {
          // Add the charged amount to customer's credit balance
          const currentCredit = Number(customer.creditBalance ?? 0);
          await tx
            .update(customersTable)
            .set({
              creditBalance: (currentCredit + chargedAmt).toFixed(2),
              updatedAt: new Date(),
            } as any)
            .where(eq(customersTable.id, customer.id));
        }
      });

      const [updated] = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, id))
        .limit(1);

      return res.json({
        ...updated,
        chargedAmount: Number(updated.chargedAmount ?? 0),
        amountPaid: Number(updated.amountPaid ?? 0),
      });
    }

    // Standard booking status update (no credit addition)
    const updates: Record<string, any> = { status: status.trim() };

    // Accept payment fields when provided
    if (chargedAmount !== undefined) updates.chargedAmount = Number(chargedAmount).toFixed(2);
    if (amountPaid !== undefined) updates.amountPaid = Number(amountPaid).toFixed(2);
    if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod;
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;

    // Auto-derive paymentStatus if not provided explicitly
    if (updates.chargedAmount !== undefined && updates.amountPaid !== undefined && paymentStatus === undefined) {
      const charged = Number(updates.chargedAmount);
      const paid = Number(updates.amountPaid);
      updates.paymentStatus = paid <= 0 ? "unpaid" : paid >= charged ? "paid" : "partial";
    }

    const [updated] = await db
      .update(bookingsTable)
      .set(updates as any)
      .where(eq(bookingsTable.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({
      ...updated,
      chargedAmount: Number(updated.chargedAmount ?? 0),
      amountPaid: Number(updated.amountPaid ?? 0),
    });
  } catch (err) {
    console.error("Booking update error:", err);
    res.status(500).json({ error: "Failed to update booking status" });
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

    if (period === "yearly") {
      startDate = new Date(refDate.getFullYear(), 0, 1);
      endDate = new Date(refDate.getFullYear() + 1, 0, 1);
    } else if (period === "monthly") {
      startDate = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      endDate = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
    } else if (period === "weekly") {
      const dayOfWeek = refDate.getDay();
      const diff = refDate.getDate() - dayOfWeek;
      startDate = new Date(refDate.setDate(diff));
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
    } else {
      // daily
      startDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
      endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + 1);
    }
  }

  try {
    const { sql: sqlRaw } = await import("drizzle-orm");

    // Fetch orders
    let ordersData = [];
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
    let bookingsData = [];
    if (type === "all" || type === "bookings") {
      bookingsData = await db
        .select({
          id: bookingsTable.id,
          customerId: bookingsTable.customerId,
          chargedAmount: bookingsTable.chargedAmount,
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
    let paymentsData = [];
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
          sqlRaw`${customerPaymentsTable.createdAt} >= ${startDate} AND ${customerPaymentsTable.createdAt} < ${endDate}`
        );
    }

    // Format transactions
    const transactions = [
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
    const totalPaymentsMade = paymentsData.reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0
    );

    res.json({
      period,
      type,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      transactions,
      summary: {
        totalAmount,
        totalOrders,
        totalOrderAmount,
        totalBookings,
        totalBookingAmount,
        totalPaymentsMade,
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

router.put("/products/:id/adjust-stock", async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { quantity, reason } = req.body;

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
      const [product] = await tx
        .select({ stockQuantity: productsTable.stockQuantity })
        .from(productsTable)
        .where(eq(productsTable.id, productId));

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

      await tx.insert(stockLedgerTable).values({
        productId,
        transactionType: "adjustment",
        quantity: adjustedQuantity,
        reason: reason.trim(),
        balanceBefore,
        balanceAfter,
        metadata: {
          adjustmentType: quantity > 0 ? "restock" : "loss",
          requestedQuantity: quantity,
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

router.post("/admin/test-data/seed", async (req, res) => {
  try {
    const { customerCount, orderCount, bookingCount, daysBack } = req.query;

    const options: any = {};
    if (customerCount) options.customerCount = Number(customerCount);
    if (orderCount) options.orderCount = Number(orderCount);
    if (bookingCount) options.bookingCount = Number(bookingCount);
    if (daysBack) options.daysBack = Number(daysBack);

    const created = await seedTestData(options);

    res.json({
      success: true,
      message: "Test data created successfully",
      created,
    });
  } catch (err) {
    console.error("Test data seeding error:", err);
    res.status(500).json({
      error: "Failed to seed test data",
      details: (err as any)?.message || String(err),
    });
  }
});

router.delete("/admin/test-data/clear", async (req, res) => {
  try {
    const cleared = await clearTestData();

    res.json({
      success: true,
      message: "Test data cleared successfully",
      cleared,
    });
  } catch (err) {
    console.error("Clear test data error:", err);
    res.status(500).json({
      error: "Failed to clear test data",
      details: (err as any)?.message || String(err),
    });
  }
});

router.get("/admin/test-data/status", async (req, res) => {
  try {
    const status = await getTestDataStatus();

    res.json({
      success: true,
      testData: status,
    });
  } catch (err) {
    console.error("Get test data status error:", err);
    res.status(500).json({
      error: "Failed to get test data status",
      details: (err as any)?.message || String(err),
    });
  }
});

router.post("/admin/backup/create", async (req, res) => {
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

router.get("/admin/backup/list", async (req, res) => {
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

router.get("/admin/backup/status", async (req, res) => {
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

router.delete("/admin/backup/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

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

router.post("/admin/backup/cleanup", async (req, res) => {
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
