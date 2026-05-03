import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  customerLedgerTable,
  customerPaymentsTable,
  invoiceItemsTable,
  invoicesTable,
  ordersTable,
  bookingsTable,
  productsTable,
  rewardTransactionsTable,
  settingsTable,
  stockLedgerTable,
} from "@workspace/db/schema";
import jwt from "jsonwebtoken";
import { customersTable } from "../../../../lib/db/src/schema/business";

const router: IRouter = Router();
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "rajesh-shopping-secret-2024";

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

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

const optionalTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(max).optional());

const customerSchema = z.object({
  name: z.string().min(1).max(120).transform((value) => value.trim()),
  phone: optionalTrimmedString(30),
  email: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().email().max(200).optional()),
  address: optionalTrimmedString(400),
  notes: optionalTrimmedString(1000),
  photoPath: optionalTrimmedString(500000),
  customerCode: optionalTrimmedString(40),
});

const invoiceItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(9999),
});

const createInvoiceSchema = z.object({
  customerId: z.number().int().positive(),
  items: z.array(invoiceItemSchema).max(100).default([]),
  paymentMethod: z.enum(["cash", "credit", "esewa", "khalti", "bank"]),
  amountPaid: z.number().nonnegative().default(0),
  note: z.string().max(1000).optional(),
});

const createPaymentSchema = z.object({
  customerId: z.number().int().positive(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["cash", "esewa", "khalti", "bank"]).default("cash"),
  referenceNote: z.string().max(500).optional(),
});

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

function buildInvoiceNumber(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `INV-${stamp}`;
}

function buildCustomerCode(id: number): string {
  return `CUST-${String(id).padStart(5, "0")}`;
}

router.get("/admin/dashboard-summary", authMiddleware, async (_req, res) => {
  try {
    const [productStats] = await db
      .select({
        totalProducts: sql<number>`count(*)`,
        lowStockProducts: sql<number>`sum(case when ${productsTable.stockQuantity} <= ${productsTable.reorderLevel} then 1 else 0 end)`,
        inventoryCost: sql<string>`coalesce(sum((${productsTable.buyingPrice} + ${productsTable.transportationCost} + ${productsTable.extraCost}) * ${productsTable.stockQuantity}), 0)`,
        inventoryRevenue: sql<string>`coalesce(sum(${productsTable.price} * ${productsTable.stockQuantity}), 0)`,
      })
      .from(productsTable);

    const [customerStats] = await db
      .select({
        totalCustomers: sql<number>`count(*)`,
        totalCreditBalance: sql<string>`coalesce(sum(${customersTable.creditBalance}), 0)`,
        totalRewardPoints: sql<number>`coalesce(sum(${customersTable.rewardPoints}), 0)`,
      })
      .from(customersTable);

    const [onlineOrderStats] = await db
      .select({
        totalOrders: sql<number>`count(*)`,
        pendingPayment: sql<number>`sum(case when ${ordersTable.paymentStatus} = 'unpaid' and ${ordersTable.status} not in ('cancelled','delivered') then 1 else 0 end)`,
        confirmedRevenue: sql<string>`coalesce(sum(case when ${ordersTable.paymentStatus} = 'paid' then ${ordersTable.totalAmount}::numeric else 0 end), 0)`,
      })
      .from(ordersTable);

    // Today's transport bookings revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [transportStats] = await db
      .select({
        totalBilled: sql<string>`coalesce(sum(charged_amount), 0)`,
        totalCollected: sql<string>`coalesce(sum(amount_paid), 0)`,
        totalCredit: sql<string>`coalesce(sum(charged_amount - amount_paid), 0)`,
        activeBookings: sql<number>`sum(case when status not in ('cancelled') then 1 else 0 end)`,
      })
      .from(bookingsTable);

    const [todayTransport] = await db
      .select({
        totalCollected: sql<string>`coalesce(sum(amount_paid), 0)`,
      })
      .from(bookingsTable)
      .where(sql`created_at >= ${today} AND created_at < ${tomorrow} AND status NOT IN ('cancelled')`);

    const [todayShop] = await db
      .select({
        totalBilled: sql<string>`coalesce(sum(${invoicesTable.subtotalAmount}), 0)`,
        totalCollected: sql<string>`coalesce(sum(${invoicesTable.amountPaid}), 0)`,
        invoiceCount: sql<number>`count(*)`,
      })
      .from(invoicesTable)
      .where(sql`${invoicesTable.createdAt} >= ${today} AND ${invoicesTable.createdAt} < ${tomorrow}`);

    const dealerEntries = await db
      .select({
        transactionType: stockLedgerTable.transactionType,
        metadata: stockLedgerTable.metadata,
      })
      .from(stockLedgerTable);
    const dealerTotals = summarizeDealerEntries(dealerEntries);
    const customerCreditDue = asNumber(customerStats?.totalCreditBalance);

    const recentInvoices = await db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        customerId: invoicesTable.customerId,
        customerName: customersTable.name,
        totalAmount: invoicesTable.totalAmount,
        amountPaid: invoicesTable.amountPaid,
        dueAmount: invoicesTable.dueAmount,
        paymentMethod: invoicesTable.paymentMethod,
        createdAt: invoicesTable.createdAt,
      })
      .from(invoicesTable)
      .innerJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
      .orderBy(desc(invoicesTable.createdAt))
      .limit(8);

    res.json({
      totals: {
        totalProducts: Number(productStats?.totalProducts ?? 0),
        lowStockProducts: Number(productStats?.lowStockProducts ?? 0),
        inventoryCost: asNumber(productStats?.inventoryCost),
        inventoryRevenue: asNumber(productStats?.inventoryRevenue),
        totalCustomers: Number(customerStats?.totalCustomers ?? 0),
        totalCreditBalance: customerCreditDue,
        totalRewardPoints: Number(customerStats?.totalRewardPoints ?? 0),
        dealerCount: dealerTotals.dealerCount,
        dealerTotalBilled: dealerTotals.totalBilled,
        dealerTotalPaid: dealerTotals.totalPaid,
        dealerTotalDue: dealerTotals.totalDue,
        dealerReturnCount: dealerTotals.returnCount,
        dealerDamagedCount: dealerTotals.damagedCount,
        netCreditPosition: customerCreditDue - dealerTotals.totalDue,
        totalOnlineOrders: Number(onlineOrderStats?.totalOrders ?? 0),
        pendingOnlineOrders: Number(onlineOrderStats?.pendingPayment ?? 0),
        confirmedOnlineRevenue: asNumber(onlineOrderStats?.confirmedRevenue),
        // Transport totals (all-time)
        transportTotalBilled: asNumber(transportStats?.totalBilled),
        transportTotalCollected: asNumber(transportStats?.totalCollected),
        transportTotalCredit: asNumber(transportStats?.totalCredit),
        transportActiveBookings: Number(transportStats?.activeBookings ?? 0),
        // Today combined
        todayShopBilled: asNumber(todayShop?.totalBilled),
        todayShopCollected: asNumber(todayShop?.totalCollected),
        todayShopInvoices: Number(todayShop?.invoiceCount ?? 0),
        todayTransportCollected: asNumber(todayTransport?.totalCollected),
        todayCombinedCollected: asNumber(todayShop?.totalCollected) + asNumber(todayTransport?.totalCollected),
      },
      recentInvoices: recentInvoices.map((invoice) => ({
        ...invoice,
        totalAmount: asNumber(invoice.totalAmount),
        amountPaid: asNumber(invoice.amountPaid),
        dueAmount: asNumber(invoice.dueAmount),
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

router.get("/admin/customers", authMiddleware, async (_req, res) => {
  try {
    const customers = await db
      .select()
      .from(customersTable)
      .orderBy(desc(customersTable.updatedAt));

    const ledgerEntries = await db
      .select()
      .from(customerLedgerTable)
      .orderBy(desc(customerLedgerTable.createdAt));

    const groupedLedger = new Map<number, Array<Record<string, unknown>>>();
    for (const entry of ledgerEntries) {
      const list = groupedLedger.get(entry.customerId) ?? [];
      list.push({
        ...entry,
        debitAmount: asNumber(entry.debitAmount),
        creditAmount: asNumber(entry.creditAmount),
        balanceAfter: asNumber(entry.balanceAfter),
      });
      groupedLedger.set(entry.customerId, list);
    }

    // Auto-create real customer records for transport booking customers with unpaid balance
    const unpaidBookings = await db
      .select()
      .from(bookingsTable)
      .where(sql`${bookingsTable.paymentStatus} in ('unpaid', 'partial')`);

    const existingPhones = new Set(customers.map(c => c.phone?.trim()).filter(Boolean));
    const existingNames = new Set(customers.map(c => c.name.toLowerCase().trim()));

    // Group by phone, create real customer records for those not yet in the table
    const bookingCustomerMap = new Map<string, { name: string; phone: string; bookings: typeof unpaidBookings }>();
    for (const b of unpaidBookings) {
      const key = b.customerPhone?.trim() || b.customerName;
      const existing = bookingCustomerMap.get(key);
      if (existing) existing.bookings.push(b);
      else bookingCustomerMap.set(key, { name: b.customerName, phone: b.customerPhone || "", bookings: [b] });
    }

    for (const tc of bookingCustomerMap.values()) {
      if (existingPhones.has(tc.phone) || existingNames.has(tc.name.toLowerCase())) continue;
      // Create a real customer record so payments/invoices work with a real integer ID
      const [created] = await db.insert(customersTable).values({
        name: tc.name,
        phone: tc.phone || null,
        customerCode: null,
        creditBalance: String(tc.bookings.reduce((s, b) => s + Number(b.chargedAmount) - Number(b.amountPaid), 0)),
        totalSpent: String(tc.bookings.reduce((s, b) => s + Number(b.chargedAmount), 0)),
      } as any).returning();
      if (created) {
        customers.push(created);
        existingPhones.add(tc.phone);
        existingNames.add(tc.name.toLowerCase());
      }
    }

    // Re-fetch updated customers to get all including newly created
    const allCustomers = await db.select().from(customersTable).orderBy(desc(customersTable.updatedAt));

    const result = allCustomers.map((customer) => ({
      ...customer,
      rewardPoints: Number(customer.rewardPoints ?? 0),
      creditBalance: asNumber(customer.creditBalance),
      totalSpent: asNumber(customer.totalSpent),
      isTransportOnly: false,
      ledger: groupedLedger.get(customer.id) ?? [],
    }));

    res.json(result);
  } catch (err) {
    console.error("Failed to get customers:", err);
    res.status(500).json({ error: "Failed to get customers" });
  }
});

router.post("/admin/customers", authMiddleware, async (req, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid customer", details: parsed.error.issues });
  }

  try {
    const [customer] = await db
      .insert(customersTable)
      .values({
        ...parsed.data,
        customerCode: null,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim().toLowerCase() || null,
        address: parsed.data.address?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        photoPath: parsed.data.photoPath?.trim() || null,
      } as any)
      .returning();

    const [codedCustomer] = await db
      .update(customersTable)
      .set({ customerCode: parsed.data.customerCode?.trim() || buildCustomerCode(customer.id), updatedAt: new Date() } as any)
      .where(eq(customersTable.id, customer.id))
      .returning();

    res.status(201).json({
      ...codedCustomer,
      rewardPoints: Number(codedCustomer.rewardPoints),
      creditBalance: asNumber(codedCustomer.creditBalance),
      totalSpent: asNumber(codedCustomer.totalSpent),
    });
  } catch {
    res.status(500).json({ error: "Failed to create customer" });
  }
});

router.put("/admin/customers/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = customerSchema.safeParse(req.body);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid customer ID" });
  }
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid customer", details: parsed.error.issues });
  }

  try {
    const [updatedCustomer] = await db
      .update(customersTable)
      .set({
        name: parsed.data.name,
        customerCode: parsed.data.customerCode?.trim() || undefined,
        phone: parsed.data.phone?.trim() || null,
        email: parsed.data.email?.trim().toLowerCase() || null,
        address: parsed.data.address?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        photoPath: parsed.data.photoPath?.trim() || null,
        updatedAt: new Date(),
      } as any)
      .where(eq(customersTable.id, id))
      .returning();

    if (!updatedCustomer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({
      ...updatedCustomer,
      rewardPoints: Number(updatedCustomer.rewardPoints),
      creditBalance: asNumber(updatedCustomer.creditBalance),
      totalSpent: asNumber(updatedCustomer.totalSpent),
    });
  } catch {
    res.status(500).json({ error: "Failed to update customer" });
  }
});

router.delete("/admin/customers/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid customer ID" });
  }

  try {
    const [invoiceCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoicesTable)
      .where(eq(invoicesTable.customerId, id));

    if (Number(invoiceCount?.count ?? 0) > 0) {
      const [updatedCustomer] = await db
        .update(customersTable)
        .set({ isActive: false, updatedAt: new Date() } as any)
        .where(eq(customersTable.id, id))
        .returning();

      if (!updatedCustomer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      return res.json({ message: "Customer archived because billing history exists", archived: true });
    }

    await db.delete(customersTable).where(eq(customersTable.id, id));
    res.json({ message: "Customer deleted", archived: false });
  } catch {
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

router.post("/admin/invoices", authMiddleware, async (req, res) => {
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid invoice", details: parsed.error.issues });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [customer] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, parsed.data.customerId))
        .limit(1);

      if (!customer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      let detailedItems: any[] = [];
      if (parsed.data.items.length > 0) {
        const productIds = parsed.data.items.map((item) => item.productId);
        const products = await tx
          .select()
          .from(productsTable)
          .where(sql`${productsTable.id} = any(array[${sql.join(productIds.map((id) => sql`${id}`), sql.raw(","))}]::int[])`);

        const productMap = new Map(products.map((product) => [product.id, product]));
        detailedItems = parsed.data.items.map((item) => {
          const product = productMap.get(item.productId);
          if (!product) throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
          if (product.stockQuantity < item.quantity) throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
          const unitCost = asNumber(product.buyingPrice) + asNumber(product.transportationCost) + asNumber(product.extraCost);
          const lineTotal = asNumber(product.price) * item.quantity;
          return { item, product, unitCost, lineTotal };
        });
      }

      const subtotalAmount = detailedItems.reduce((sum, entry) => sum + entry.lineTotal, 0);
      const previousDueAmount = asNumber(customer.creditBalance);
      const totalAmount = subtotalAmount + previousDueAmount;
      const amountPaid = parsed.data.amountPaid;
      const dueAmount = Math.max(totalAmount - amountPaid, 0);

      const [settings] = await tx.select().from(settingsTable).limit(1);
      const rewardRate = Number(settings?.rewardRate ?? 1);
      const rewardUnitAmount = asNumber(settings?.rewardUnitAmount ?? 100);
      const rewardPointsEarned =
        rewardUnitAmount > 0
          ? Math.floor(subtotalAmount / rewardUnitAmount) * rewardRate
          : 0;

      const [invoice] = await tx
        .insert(invoicesTable)
        .values({
          customerId: customer.id,
          invoiceNumber: buildInvoiceNumber(),
          subtotalAmount: subtotalAmount.toFixed(2),
          previousDueAmount: previousDueAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          amountPaid: amountPaid.toFixed(2),
          dueAmount: dueAmount.toFixed(2),
          paymentMethod: parsed.data.paymentMethod,
          paymentStatus: dueAmount > 0 ? "partial" : "paid",
          rewardPointsEarned,
          note: parsed.data.note?.trim() || null,
          printedAt: new Date(),
        })
        .returning();

      if (detailedItems.length > 0) {
        await tx.insert(invoiceItemsTable).values(
          detailedItems.map(({ item, product, unitCost, lineTotal }) => ({
            invoiceId: invoice.id,
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            unit: product.unit,
            unitPrice: asNumber(product.price).toFixed(2),
            unitCost: unitCost.toFixed(2),
            lineTotal: lineTotal.toFixed(2),
          })),
        );
      }

      for (const { item, product } of detailedItems) {
        await tx
          .update(productsTable)
          .set({
            stockQuantity: product.stockQuantity - item.quantity,
            inStock: product.stockQuantity - item.quantity > 0,
          })
          .where(eq(productsTable.id, product.id));
      }

      await tx
        .update(customersTable)
        .set({
          creditBalance: dueAmount.toFixed(2),
          totalSpent: (asNumber(customer.totalSpent) + subtotalAmount).toFixed(2),
          rewardPoints: customer.rewardPoints + rewardPointsEarned,
          updatedAt: new Date(),
        })
        .where(eq(customersTable.id, customer.id));

      await tx.insert(customerLedgerTable).values({
        customerId: customer.id,
        invoiceId: invoice.id,
        entryType: "invoice",
        description: `Invoice ${invoice.invoiceNumber}`,
        debitAmount: totalAmount.toFixed(2),
        creditAmount: amountPaid.toFixed(2),
        balanceAfter: dueAmount.toFixed(2),
        metadata: {
          paymentMethod: parsed.data.paymentMethod,
          subtotalAmount,
          previousDueAmount,
          rewardPointsEarned,
        },
      });

      if (amountPaid > 0) {
        const [payment] = await tx
          .insert(customerPaymentsTable)
          .values({
            customerId: customer.id,
            invoiceId: invoice.id,
            amount: amountPaid.toFixed(2),
            paymentMethod: parsed.data.paymentMethod,
            referenceNote: parsed.data.note?.trim() || "Invoice payment",
          })
          .returning();

        await tx
          .update(customerLedgerTable)
          .set({ paymentId: payment.id })
          .where(and(eq(customerLedgerTable.invoiceId, invoice.id), eq(customerLedgerTable.customerId, customer.id)));
      }

      if (rewardPointsEarned > 0) {
        await tx.insert(rewardTransactionsTable).values({
          customerId: customer.id,
          invoiceId: invoice.id,
          points: rewardPointsEarned,
          reason: `Invoice ${invoice.invoiceNumber}`,
        });
      }

      const items = await tx.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, invoice.id));

      return {
        invoice,
        customer,
        items,
      };
    });

    res.status(201).json({
      invoice: {
        ...result.invoice,
        subtotalAmount: asNumber(result.invoice.subtotalAmount),
        previousDueAmount: asNumber(result.invoice.previousDueAmount),
        totalAmount: asNumber(result.invoice.totalAmount),
        amountPaid: asNumber(result.invoice.amountPaid),
        dueAmount: asNumber(result.invoice.dueAmount),
      },
      customer: result.customer,
      items: result.items.map((item) => ({
        ...item,
        unitPrice: asNumber(item.unitPrice),
        unitCost: asNumber(item.unitCost),
        lineTotal: asNumber(item.lineTotal),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "CUSTOMER_NOT_FOUND") {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (message.startsWith("PRODUCT_NOT_FOUND")) {
      return res.status(404).json({ error: "One or more products were not found" });
    }
    if (message.startsWith("INSUFFICIENT_STOCK")) {
      return res.status(400).json({ error: message.split(":")[1] || "Insufficient stock" });
    }
    return res.status(500).json({ error: "Failed to create invoice" });
  }
});

router.post("/admin/payments", authMiddleware, async (req, res) => {
  const parsed = createPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payment", details: parsed.error.issues });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [customer] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, parsed.data.customerId))
        .limit(1);

      if (!customer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      const newBalance = Math.max(asNumber(customer.creditBalance) - parsed.data.amount, 0);

      const [payment] = await tx
        .insert(customerPaymentsTable)
        .values({
          customerId: customer.id,
          amount: parsed.data.amount.toFixed(2),
          paymentMethod: parsed.data.paymentMethod,
          referenceNote: parsed.data.referenceNote?.trim() || "Manual repayment",
        })
        .returning();

      await tx
        .update(customersTable)
        .set({
          creditBalance: newBalance.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(customersTable.id, customer.id));

      await tx.insert(customerLedgerTable).values({
        customerId: customer.id,
        paymentId: payment.id,
        entryType: "payment",
        description: parsed.data.referenceNote?.trim() || "Credit repayment",
        debitAmount: "0.00",
        creditAmount: parsed.data.amount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        metadata: {
          paymentMethod: parsed.data.paymentMethod,
        },
      });

      return { payment, newBalance };
    });

    res.status(201).json({
      ...result.payment,
      amount: asNumber(result.payment.amount),
      newBalance: result.newBalance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "CUSTOMER_NOT_FOUND") {
      return res.status(404).json({ error: "Customer not found" });
    }
    return res.status(500).json({ error: "Failed to record payment" });
  }
});

router.get("/admin/invoices/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, id))
      .limit(1);

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, invoice.customerId))
      .limit(1);
    const items = await db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, invoice.id));

    return res.json({
      invoice: {
        ...invoice,
        subtotalAmount: asNumber(invoice.subtotalAmount),
        previousDueAmount: asNumber(invoice.previousDueAmount),
        totalAmount: asNumber(invoice.totalAmount),
        amountPaid: asNumber(invoice.amountPaid),
        dueAmount: asNumber(invoice.dueAmount),
      },
      customer: customer
        ? {
            ...customer,
            creditBalance: asNumber(customer.creditBalance),
            totalSpent: asNumber(customer.totalSpent),
          }
        : null,
      items: items.map((item) => ({
        ...item,
        unitPrice: asNumber(item.unitPrice),
        unitCost: asNumber(item.unitCost),
        lineTotal: asNumber(item.lineTotal),
      })),
    });
  } catch {
    return res.status(500).json({ error: "Failed to get invoice" });
  }
});

export default router;
