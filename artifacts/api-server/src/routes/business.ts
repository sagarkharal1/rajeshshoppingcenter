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
import { customersTable } from "../../../../lib/db/src/schema/business";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

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
  proofPath: z.string().max(500000).optional(),
});

const createPaymentSchema = z.object({
  customerId: z.number().int().positive(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["cash", "esewa", "khalti", "bank"]).default("cash"),
  referenceNote: z.string().max(1200).optional(),
  proofPath: z.string().max(500000).optional(),
});

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

// Date prefix only. The invoice's own id is appended once the row exists,
// because a timestamp alone (even to the second) collides whenever two bills
// are saved in the same second — leaving different customers holding bills
// with the same number.
function buildInvoiceDatePrefix(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
}

function buildInvoiceNumber(id: number): string {
  return `INV-${buildInvoiceDatePrefix()}-${String(id).padStart(4, "0")}`;
}

function getProofDateRange(period: string, dateValue: string) {
  const base = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) {
    base.setTime(Date.now());
  }
  base.setHours(0, 0, 0, 0);

  const start = new Date(base);
  const end = new Date(base);
  if (period === "year") {
    start.setMonth(0, 1);
    end.setFullYear(start.getFullYear() + 1, 0, 1);
  } else if (period === "month") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 1);
  } else {
    end.setDate(start.getDate() + 1);
  }
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

function containsProofSearch(record: Record<string, unknown>, search: string) {
  if (!search) return true;
  const haystack = [
    record.type,
    record.reference,
    record.customerName,
    record.customerPhone,
    record.partyName,
    record.partyPhone,
    record.paymentMethod,
    record.paymentStatus,
    record.status,
    record.note,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes(search);
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
        // Partly-paid orders still need chasing, so they count as pending.
        pendingPayment: sql<number>`sum(case when ${ordersTable.paymentStatus} in ('unpaid','partial') and ${ordersTable.status} not in ('cancelled','delivered') then 1 else 0 end)`,
        // Count money actually received: the full total once paid, otherwise
        // whatever has been collected so far.
        confirmedRevenue: sql<string>`coalesce(sum(case when ${ordersTable.paymentStatus} = 'paid' then ${ordersTable.totalAmount}::numeric else coalesce(${ordersTable.amountPaid}::numeric, 0) end), 0)`,
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
      .where(sql`${invoicesTable.createdAt} >= ${today} AND ${invoicesTable.createdAt} < ${tomorrow} AND ${invoicesTable.voidedAt} is null`);

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
      .where(sql`${invoicesTable.voidedAt} is null`)
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

router.get("/admin/proof-register", authMiddleware, async (req, res) => {
  try {
    const period = String(req.query.period || "month");
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const type = String(req.query.type || "all").toLowerCase();
    const search = String(req.query.search || "").trim().toLowerCase();
    const { start, end } = getProofDateRange(period, date);

    const records: Array<Record<string, unknown>> = [];

    if (type === "all" || type === "invoice") {
      const invoices = await db
        .select({
          id: invoicesTable.id,
          reference: invoicesTable.invoiceNumber,
          customerName: customersTable.name,
          customerPhone: customersTable.phone,
          totalAmount: invoicesTable.totalAmount,
          amountPaid: invoicesTable.amountPaid,
          dueAmount: invoicesTable.dueAmount,
          paymentMethod: invoicesTable.paymentMethod,
          paymentStatus: invoicesTable.paymentStatus,
          note: invoicesTable.note,
          createdAt: invoicesTable.createdAt,
        })
        .from(invoicesTable)
        .innerJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
        .where(sql`${invoicesTable.createdAt} >= ${start} AND ${invoicesTable.createdAt} < ${end} AND ${invoicesTable.voidedAt} is null`)
        .orderBy(desc(invoicesTable.createdAt))
        .limit(500);

      records.push(
        ...invoices.map((invoice) => ({
          type: "invoice",
          id: invoice.id,
          reference: invoice.reference,
          date: invoice.createdAt,
          partyName: invoice.customerName,
          partyPhone: invoice.customerPhone,
          totalAmount: asNumber(invoice.totalAmount),
          amountPaid: asNumber(invoice.amountPaid),
          dueAmount: asNumber(invoice.dueAmount),
          paymentMethod: invoice.paymentMethod,
          paymentStatus: invoice.paymentStatus,
          note: invoice.note,
          proofStatus: (invoice as any).proofPath ? "proof-attached" : "invoice-saved",
          proofPath: (invoice as any).proofPath || null,
        })),
      );
    }

    if (type === "all" || type === "payment") {
      const payments = await db
        .select({
          id: customerPaymentsTable.id,
          customerName: customersTable.name,
          customerPhone: customersTable.phone,
          invoiceNumber: invoicesTable.invoiceNumber,
          amount: customerPaymentsTable.amount,
          paymentMethod: customerPaymentsTable.paymentMethod,
          referenceNote: customerPaymentsTable.referenceNote,
          proofPath: sql<string | null>`customer_payments.proof_path`,
          createdAt: customerPaymentsTable.createdAt,
        })
        .from(customerPaymentsTable)
        .innerJoin(customersTable, eq(customerPaymentsTable.customerId, customersTable.id))
        .leftJoin(invoicesTable, eq(customerPaymentsTable.invoiceId, invoicesTable.id))
        .where(sql`${customerPaymentsTable.createdAt} >= ${start} AND ${customerPaymentsTable.createdAt} < ${end} AND ${customerPaymentsTable.voidedAt} is null`)
        .orderBy(desc(customerPaymentsTable.createdAt))
        .limit(500);

      records.push(
        ...payments.map((payment) => ({
          type: "payment",
          id: payment.id,
          reference: payment.invoiceNumber ? `${payment.invoiceNumber} / PAY-${payment.id}` : `PAY-${payment.id}`,
          date: payment.createdAt,
          partyName: payment.customerName,
          partyPhone: payment.customerPhone,
          totalAmount: asNumber(payment.amount),
          amountPaid: asNumber(payment.amount),
          dueAmount: 0,
          paymentMethod: payment.paymentMethod,
          paymentStatus: "paid",
          note: payment.referenceNote,
          proofStatus: payment.proofPath ? "proof-attached" : payment.referenceNote ? "reference-saved" : "payment-saved",
          proofPath: payment.proofPath || null,
        })),
      );
    }

    if (type === "all" || type === "order") {
      const orders = await db
        .select()
        .from(ordersTable)
        .where(sql`${ordersTable.createdAt} >= ${start} AND ${ordersTable.createdAt} < ${end}`)
        .orderBy(desc(ordersTable.createdAt))
        .limit(500);

      records.push(
        ...orders.map((order) => ({
          type: "order",
          id: order.id,
          reference: `ORDER-${order.id}`,
          date: order.createdAt,
          partyName: order.customerName,
          partyPhone: order.customerPhone,
          totalAmount: asNumber(order.totalAmount),
          // Read the recorded amount rather than inferring it from the status:
          // a partly-paid order would otherwise report nothing received and
          // the whole total still owed.
          amountPaid:
            order.paymentStatus === "paid"
              ? asNumber(order.totalAmount)
              : asNumber((order as any).amountPaid),
          dueAmount:
            order.paymentStatus === "paid"
              ? 0
              : Math.max(asNumber(order.totalAmount) - asNumber((order as any).amountPaid), 0),
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          status: order.status,
          note: order.notes,
          proofStatus: order.paymentScreenshotPath ? "payment-proof-attached" : "order-saved",
          proofPath: order.paymentScreenshotPath,
        })),
      );
    }

    if (type === "all" || type === "booking") {
      const bookings = await db
        .select()
        .from(bookingsTable)
        .where(sql`${bookingsTable.createdAt} >= ${start} AND ${bookingsTable.createdAt} < ${end}`)
        .orderBy(desc(bookingsTable.createdAt))
        .limit(500);

      records.push(
        ...bookings.map((booking) => ({
          type: "booking",
          id: booking.id,
          reference: `BOOKING-${booking.id}`,
          date: booking.createdAt,
          partyName: booking.customerName,
          partyPhone: booking.customerPhone,
          totalAmount: asNumber(booking.chargedAmount),
          amountPaid: asNumber(booking.amountPaid),
          dueAmount: Math.max(asNumber(booking.chargedAmount) - asNumber(booking.amountPaid), 0),
          paymentMethod: booking.paymentMethod,
          paymentStatus: booking.paymentStatus,
          status: booking.status,
          note: [booking.serviceType, booking.pickupLocation, booking.destination, booking.notes].filter(Boolean).join(" | "),
          proofStatus: (booking as any).proofPath ? "proof-attached" : "booking-saved",
          proofPath: (booking as any).proofPath || null,
        })),
      );
    }

    if (type === "all" || type === "dealer") {
      const dealerEntries = await db
        .select({
          id: stockLedgerTable.id,
          productName: productsTable.name,
          transactionType: stockLedgerTable.transactionType,
          quantity: stockLedgerTable.quantity,
          reason: stockLedgerTable.reason,
          createdAt: stockLedgerTable.createdAt,
          metadata: stockLedgerTable.metadata,
        })
        .from(stockLedgerTable)
        .leftJoin(productsTable, eq(stockLedgerTable.productId, productsTable.id))
        .where(sql`${stockLedgerTable.createdAt} >= ${start} AND ${stockLedgerTable.createdAt} < ${end}`)
        .orderBy(desc(stockLedgerTable.createdAt))
        .limit(500);

      records.push(
        ...dealerEntries
          .filter((entry) => String((entry.metadata || {}).dealerName || "").trim())
          .map((entry) => {
            const metadata = (entry.metadata || {}) as Record<string, any>;
            const isPayment = String(entry.transactionType || "").toLowerCase() === "dealer_payment";
            const billAmount = asNumber(metadata.billAmount);
            const paidAmount = asNumber(metadata.paidAmount);
            return {
              type: "dealer",
              id: entry.id,
              reference: metadata.billNumber || `DEALER-${entry.id}`,
              date: entry.createdAt,
              partyName: metadata.dealerName,
              partyPhone: metadata.dealerPhone,
              totalAmount: isPayment ? paidAmount : billAmount,
              amountPaid: paidAmount,
              dueAmount: isPayment ? 0 : Math.max(billAmount - paidAmount, 0),
              paymentMethod: isPayment ? "cash" : "dealer-credit",
              paymentStatus: isPayment || billAmount <= paidAmount ? "paid" : "partial",
              status: entry.transactionType,
              note: [entry.productName, entry.reason, metadata.returnStatus, metadata.damagedReason].filter(Boolean).join(" | "),
              proofStatus: metadata.billNumber ? "bill-number-saved" : "dealer-record-saved",
              proofPath: metadata.proofPath || null,
            };
          }),
      );
    }

    const filtered = records
      .filter((record) => containsProofSearch(record, search))
      .sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime());

    res.json({
      period,
      date,
      range: { start: start.toISOString(), end: end.toISOString() },
      records: filtered,
      summary: {
        count: filtered.length,
        totalBilled: filtered.reduce((sum, record) => sum + asNumber(record.totalAmount), 0),
        totalPaid: filtered.reduce((sum, record) => sum + asNumber(record.amountPaid), 0),
        totalDue: filtered.reduce((sum, record) => sum + asNumber(record.dueAmount), 0),
        withProof: filtered.filter((record) => String(record.proofStatus || "").includes("proof") || String(record.proofStatus || "").includes("saved")).length,
      },
    });
  } catch (err) {
    console.error("Failed to load proof register:", err);
    res.status(500).json({ error: "Failed to load proof register" });
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

// A counter sale to someone who isn't a regular customer still needs a
// customer row for the invoice to hang off. Rather than making the shopkeeper
// register every stranger, all such sales share one reserved record.
const WALK_IN_CODE = "WALK-IN";

router.post("/admin/customers/walk-in", authMiddleware, async (_req, res) => {
  try {
    const [existing] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.customerCode, WALK_IN_CODE))
      .limit(1);

    const customer =
      existing ??
      (
        await db
          .insert(customersTable)
          .values({
            name: "Walk-in Customer",
            customerCode: WALK_IN_CODE,
            notes: "Shared record for counter sales to unregistered customers.",
          } as any)
          .returning()
      )[0];

    res.json({
      ...customer,
      rewardPoints: Number(customer.rewardPoints),
      creditBalance: asNumber(customer.creditBalance),
      totalSpent: asNumber(customer.totalSpent),
      isWalkIn: true,
    });
  } catch (error) {
    console.error("Walk-in customer error:", error);
    res.status(500).json({ error: "Could not start a walk-in sale" });
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

      // Credit against the shared walk-in record would merge unrelated
      // strangers' debts into one untraceable balance.
      if (customer.customerCode === WALK_IN_CODE && dueAmount > 0) {
        throw new Error("WALK_IN_CREDIT_NOT_ALLOWED");
      }

      const [settings] = await tx.select().from(settingsTable).limit(1);
      const rewardRate = Number(settings?.rewardRate ?? 1);
      const rewardUnitAmount = asNumber(settings?.rewardUnitAmount ?? 100);
      const rewardPointsEarned =
        rewardUnitAmount > 0
          ? Math.floor(subtotalAmount / rewardUnitAmount) * rewardRate
          : 0;

      const [inserted] = await tx
        .insert(invoicesTable)
        .values({
          customerId: customer.id,
          // Replaced immediately below with a number that includes the row id.
          invoiceNumber: `INV-${buildInvoiceDatePrefix()}-PENDING`,
          subtotalAmount: subtotalAmount.toFixed(2),
          previousDueAmount: previousDueAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          amountPaid: amountPaid.toFixed(2),
          dueAmount: dueAmount.toFixed(2),
          paymentMethod: parsed.data.paymentMethod,
          paymentStatus: dueAmount > 0 ? "partial" : "paid",
          rewardPointsEarned,
          note: parsed.data.note?.trim() || null,
          proofPath: parsed.data.proofPath?.trim() || null,
          printedAt: new Date(),
        } as any)
        .returning();

      // The id is unique, so the resulting number always is too.
      const [invoice] = await tx
        .update(invoicesTable)
        .set({ invoiceNumber: buildInvoiceNumber(inserted.id) })
        .where(eq(invoicesTable.id, inserted.id))
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
            stockQuantity: sql`GREATEST(${productsTable.stockQuantity} - ${item.quantity}, 0)`,
            inStock: sql`(${productsTable.stockQuantity} - ${item.quantity}) > 0`,
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
            proofPath: parsed.data.proofPath?.trim() || null,
          } as any)
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
    if (message === "WALK_IN_CREDIT_NOT_ALLOWED") {
      return res.status(400).json({
        error: "A walk-in sale must be fully paid. To give credit, save this person as a customer first.",
      });
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
          proofPath: parsed.data.proofPath?.trim() || null,
        } as any)
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
          proofPath: parsed.data.proofPath?.trim() || null,
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

const voidSchema = z.object({
  reason: z.string().min(1, "A reason is required").max(300).transform((value) => value.trim()),
});

// Voiding keeps the original row for the audit trail and writes a compensating
// ledger entry, rather than deleting history. The customer's credit balance is
// rebuilt from the surviving (non-voided) invoices and payments so it stays
// correct no matter what happened after the mistake was made.
async function recalculateCustomerBalance(tx: any, customerId: number) {
  const [totals] = await tx
    .select({
      billed: sql<string>`coalesce(sum(${invoicesTable.subtotalAmount}) filter (where ${invoicesTable.voidedAt} is null), 0)`,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.customerId, customerId));

  const [paid] = await tx
    .select({
      total: sql<string>`coalesce(sum(${customerPaymentsTable.amount}) filter (where ${customerPaymentsTable.voidedAt} is null), 0)`,
    })
    .from(customerPaymentsTable)
    .where(eq(customerPaymentsTable.customerId, customerId));

  const balance = Math.max(asNumber(totals?.billed) - asNumber(paid?.total), 0);
  await tx
    .update(customersTable)
    .set({ creditBalance: balance.toFixed(2), updatedAt: new Date() })
    .where(eq(customersTable.id, customerId));

  return balance;
}

router.post("/admin/invoices/:id/void", authMiddleware, async (req, res) => {
  const parsed = voidSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "A reason is required" });
  }

  try {
    const invoiceId = Number(req.params.id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ error: "Invalid invoice id" });
    }

    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoicesTable)
        .where(eq(invoicesTable.id, invoiceId))
        .limit(1)
        .for("update");

      if (!invoice) throw new Error("INVOICE_NOT_FOUND");
      if (invoice.voidedAt) throw new Error("ALREADY_VOIDED");

      const items = await tx
        .select()
        .from(invoiceItemsTable)
        .where(eq(invoiceItemsTable.invoiceId, invoiceId));

      // Put the sold stock back.
      for (const item of items) {
        await tx
          .update(productsTable)
          .set({
            stockQuantity: sql`${productsTable.stockQuantity} + ${item.quantity}`,
            inStock: sql`(${productsTable.stockQuantity} + ${item.quantity}) > 0`,
          })
          .where(eq(productsTable.id, item.productId));

        await tx.insert(stockLedgerTable).values({
          productId: item.productId,
          transactionType: "void",
          quantity: item.quantity,
          reason: `Invoice ${invoice.invoiceNumber} voided: ${parsed.data.reason}`,
          linkedEntityType: "invoice",
          linkedEntityId: invoice.id,
          balanceBefore: 0,
          balanceAfter: 0,
          metadata: { productName: item.productName, voided: true },
        });
      }

      // Void the payment that was taken as part of this invoice, if any.
      await tx
        .update(customerPaymentsTable)
        .set({ voidedAt: new Date(), voidReason: `Invoice ${invoice.invoiceNumber} voided` })
        .where(and(eq(customerPaymentsTable.invoiceId, invoiceId), sql`${customerPaymentsTable.voidedAt} is null`));

      await tx
        .update(invoicesTable)
        .set({ voidedAt: new Date(), voidReason: parsed.data.reason })
        .where(eq(invoicesTable.id, invoiceId));

      // Take back reward points and spend recorded by the mistaken invoice.
      const [customer] = await tx
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, invoice.customerId))
        .limit(1);

      if (customer) {
        const restoredPoints = Math.max(
          Number(customer.rewardPoints ?? 0) - Number(invoice.rewardPointsEarned ?? 0),
          0,
        );
        const restoredSpend = Math.max(
          asNumber(customer.totalSpent) - asNumber(invoice.subtotalAmount),
          0,
        );
        await tx
          .update(customersTable)
          .set({ rewardPoints: restoredPoints, totalSpent: restoredSpend.toFixed(2), updatedAt: new Date() })
          .where(eq(customersTable.id, customer.id));

        if (Number(invoice.rewardPointsEarned ?? 0) > 0) {
          await tx.insert(rewardTransactionsTable).values({
            customerId: customer.id,
            invoiceId: invoice.id,
            points: -Number(invoice.rewardPointsEarned ?? 0),
            reason: `Invoice ${invoice.invoiceNumber} voided`,
          });
        }
      }

      const balance = await recalculateCustomerBalance(tx, invoice.customerId);

      await tx.insert(customerLedgerTable).values({
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        entryType: "void",
        description: `Invoice ${invoice.invoiceNumber} voided: ${parsed.data.reason}`,
        debitAmount: "0.00",
        creditAmount: asNumber(invoice.subtotalAmount).toFixed(2),
        balanceAfter: balance.toFixed(2),
        metadata: { voidedInvoiceNumber: invoice.invoiceNumber, reason: parsed.data.reason },
      });

      return { invoiceNumber: invoice.invoiceNumber, balance, restoredItems: items.length };
    });

    res.json({
      success: true,
      message: `Invoice ${result.invoiceNumber} voided. Stock and balance have been corrected.`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "INVOICE_NOT_FOUND") return res.status(404).json({ error: "Invoice not found" });
    if (message === "ALREADY_VOIDED") return res.status(400).json({ error: "This invoice is already voided" });
    console.error("Void invoice error:", error);
    return res.status(500).json({ error: "Failed to void invoice" });
  }
});

router.post("/admin/payments/:id/void", authMiddleware, async (req, res) => {
  const parsed = voidSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "A reason is required" });
  }

  try {
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({ error: "Invalid payment id" });
    }

    const result = await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(customerPaymentsTable)
        .where(eq(customerPaymentsTable.id, paymentId))
        .limit(1)
        .for("update");

      if (!payment) throw new Error("PAYMENT_NOT_FOUND");
      if (payment.voidedAt) throw new Error("ALREADY_VOIDED");

      await tx
        .update(customerPaymentsTable)
        .set({ voidedAt: new Date(), voidReason: parsed.data.reason })
        .where(eq(customerPaymentsTable.id, paymentId));

      const balance = await recalculateCustomerBalance(tx, payment.customerId);

      await tx.insert(customerLedgerTable).values({
        customerId: payment.customerId,
        paymentId: payment.id,
        entryType: "void",
        description: `Payment of ${asNumber(payment.amount).toFixed(2)} voided: ${parsed.data.reason}`,
        debitAmount: asNumber(payment.amount).toFixed(2),
        creditAmount: "0.00",
        balanceAfter: balance.toFixed(2),
        metadata: { voidedPaymentId: payment.id, reason: parsed.data.reason },
      });

      return { amount: asNumber(payment.amount), balance };
    });

    res.json({
      success: true,
      message: "Payment voided. The customer's balance has been corrected.",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "PAYMENT_NOT_FOUND") return res.status(404).json({ error: "Payment not found" });
    if (message === "ALREADY_VOIDED") return res.status(400).json({ error: "This payment is already voided" });
    console.error("Void payment error:", error);
    return res.status(500).json({ error: "Failed to void payment" });
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
