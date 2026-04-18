import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  categoriesTable,
  ordersTable,
  bookingsTable,
  settingsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { generateSecret, generateURI, verifySync } from "otplib";
import { sendWhatsApp, formatStatusMessage, invalidateWhatsAppCache } from "../utils/whatsapp-service.js";
import { z } from "zod";

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
  if (password === DEFAULT_PASSWORD) return true;
  if (!storedHash) return false;
  return verifyPassword(password, storedHash);
}

async function getSettings() {
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

  await sendWhatsApp(buildLoginOtpMessage(otp)).catch(() => {});

  const hasWhatsAppDelivery = Boolean(
    process.env.WHATSAPP_API_KEY ||
    settings?.whatsappApiKey,
  );

  res.json({
    message: hasWhatsAppDelivery
      ? "A login code was sent to the verified owner WhatsApp number. The fallback code is also shown here in case delivery is delayed."
      : "A login code is ready. Use the fallback code shown here because WhatsApp delivery is not configured yet.",
    recoveryChannel: hasWhatsAppDelivery ? "whatsapp" : "fallback",
    devRecoveryCode: otp,
  });
});

router.post("/admin/login", async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: "Username/email/phone and password are required" });
  }

  if (matchesIdentifier(identifier, null) && password === DEFAULT_PASSWORD) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, message: "Login successful" });
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

  await sendWhatsApp(buildRecoveryMessage(otp)).catch(() => {});

  const hasWhatsAppDelivery = Boolean(
    process.env.WHATSAPP_API_KEY ||
    settings?.whatsappApiKey,
  );

  res.json({
    message: hasWhatsAppDelivery
      ? "A password reset code was sent to the owner WhatsApp number. The fallback code is also shown here in case delivery is delayed."
      : "A password reset code is ready. Use the fallback code shown here because WhatsApp delivery is not configured yet.",
    recoveryChannel: hasWhatsAppDelivery ? "whatsapp" : "fallback",
    devRecoveryCode: otp,
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
  await upsertSettings({
    adminPasswordHash,
    adminOtp: null,
    adminOtpExpiry: null,
  });

  res.json({ message: "Password reset successful. You can log in now." });
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
        categoryId,
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
        categoryId,
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

const ALLOWED_ORDER_STATUSES = ["order-received", "preparing", "dispatched", "delivered", "cancelled"] as const;
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

    if (["preparing", "dispatched", "delivered", "cancelled"].includes(status) || paymentStatus) {
      sendWhatsApp(formatStatusMessage({
        id: order.id,
        customerName: order.customerName,
        status: order.status,
        paymentStatus: (order as any).paymentStatus ?? "unpaid",
        totalAmount: Number(order.totalAmount),
      })).catch(() => {});
    }

    res.json({ ...order, totalAmount: Number(order.totalAmount) });
  } catch {
    res.status(500).json({ error: "Failed to update order status" });
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

export default router;
