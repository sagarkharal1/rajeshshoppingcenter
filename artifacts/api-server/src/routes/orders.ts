import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { bookingsTable, customerLedgerTable, customerPaymentsTable, invoicesTable, productsTable, rewardTransactionsTable, settingsTable } from "@workspace/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { sendTelegramMessage, formatTelegramBookingMessage, formatTelegramOrderMessage } from "../utils/telegram-service.js";
import { customersTable } from "../../../../lib/db/src/schema/business";
import { ordersTable } from "../../../../lib/db/src/schema/orders";

const router: IRouter = Router();

const PHONE_RE = /^\+?[\d\s\-]{7,20}$/;

const orderItemSchema = z.object({
  productId: z.number().int().positive(),
  productName: z.string().min(1).max(200).transform(s => s.trim()),
  price: z.number().nonnegative(),
  quantity: z.number().positive().max(999),
  unit: z.string().max(20).default("pc"),
});

const createOrderSchema = z.object({
  customerName: z.string().min(1, "Name is required").max(100).transform(s => s.trim()),
  customerPhone: z
    .string()
    .min(7, "Phone number is too short")
    .max(20)
    .regex(PHONE_RE, "Invalid phone number")
    .transform(s => s.trim()),
  customerEmail: z.string().email("Invalid email").max(200).transform(s => s.trim().toLowerCase()).optional(),
  customerAddress: z.string().min(1, "Address is required").max(500).transform(s => s.trim()),
  items: z.array(orderItemSchema).min(1, "Order must have at least one item").max(50),
  notes: z.string().max(1000).transform(s => s.trim()).optional(),
  paymentMethod: z.enum(["bank", "esewa", "khalti"]).default("bank"),
  paymentStatus: z.enum(["paid", "unpaid"]).default("unpaid"),
  customerPhotoPath: z.string().max(500000).optional(), // Customer ID or profile photo
  paymentScreenshotPath: z.string().max(500000).optional(), // eSewa / Khalti payment proof screenshot
});

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

function buildCustomerCode(id: number) {
  return `CUST-${String(id).padStart(5, "0")}`;
}

const createBookingSchema = z.object({
  serviceType: z.enum(["jeep", "tractor", "telcoline"]),
  customerName: z.string().min(1, "Name is required").max(100).transform(s => s.trim()),
  customerPhone: z
    .string()
    .min(7, "Phone number is too short")
    .max(20)
    .regex(PHONE_RE, "Invalid phone number")
    .transform(s => s.trim()),
  pickupLocation: z.string().min(1, "Pickup location is required").max(200).transform(s => s.trim()),
  destination: z.string().min(1, "Destination is required").max(200).transform(s => s.trim()),
  bookingDate: z.string().min(1, "Date is required").max(100).transform(s => s.trim()),
  notes: z.string().max(1000).transform(s => s.trim()).optional(),
});

router.post("/orders", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.issues.map(i => i.message),
    });
  }

  try {
    const { customerName, customerPhone, customerEmail, customerAddress, items, notes, paymentMethod, paymentStatus, customerPhotoPath, paymentScreenshotPath } = parsed.data;

    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const result = await db.transaction(async (tx) => {
      const existingCustomers = await tx
        .select()
        .from(customersTable)
        .orderBy(desc(customersTable.updatedAt));

      const normalizedPhone = normalizePhone(customerPhone);
      const normalizedEmail = customerEmail?.trim().toLowerCase() || "";
      let customer: any =
        existingCustomers.find((entry) => entry.phone && normalizePhone(entry.phone) === normalizedPhone) ??
        (normalizedEmail
          ? existingCustomers.find((entry: any) => (entry.email || "").trim().toLowerCase() === normalizedEmail)
          : null) ??
        null;

      if (customer) {
        const [updatedCustomer] = await tx
          .update(customersTable)
          .set({
            name: customerName,
            phone: customerPhone,
            email: normalizedEmail || customer.email || null,
            address: customerAddress,
            photoPath: customerPhotoPath?.trim() || customer.photoPath || null,
            notes: notes || customer.notes || null,
            totalSpent: (Number(customer.totalSpent) + totalAmount).toFixed(2),
            updatedAt: new Date(),
          } as any)
          .where(eq(customersTable.id, customer.id))
          .returning();
        customer = updatedCustomer;
      } else {
        const [createdCustomer] = await tx
          .insert(customersTable)
          .values({
            name: customerName,
            phone: customerPhone,
            email: normalizedEmail || null,
            address: customerAddress,
            photoPath: customerPhotoPath?.trim() || null,
            notes: notes || null,
            totalSpent: totalAmount.toFixed(2),
          } as any)
          .returning();

        const [codedCustomer] = await tx
          .update(customersTable)
          .set({
            customerCode: buildCustomerCode(createdCustomer.id),
            updatedAt: new Date(),
          } as any)
          .where(eq(customersTable.id, createdCustomer.id))
          .returning();
        customer = codedCustomer;
      }

      const [settings] = await tx.select().from(settingsTable).limit(1);
      const rewardRate = Number(settings?.rewardRate ?? 1);
      const rewardUnitAmount = Number(settings?.rewardUnitAmount ?? 100);
      const rewardPointsEarned =
        rewardUnitAmount > 0 ? Math.floor(totalAmount / rewardUnitAmount) * rewardRate : 0;

      const [rewardedCustomer] = await tx
        .update(customersTable)
        .set({
          rewardPoints: Number(customer.rewardPoints ?? 0) + rewardPointsEarned,
          updatedAt: new Date(),
        } as any)
        .where(eq(customersTable.id, customer.id))
        .returning();
      customer = rewardedCustomer;

      const [order] = await tx
        .insert(ordersTable)
        .values({
          customerId: customer.id,
          customerCode: customer.customerCode,
          customerName,
          customerPhone,
          customerEmail: normalizedEmail || customer.email || null,
          customerAddress,
          customerPhotoPath: customerPhotoPath?.trim() || customer.photoPath || null,
          paymentScreenshotPath: paymentScreenshotPath?.trim() || null,
          items,
          totalAmount: totalAmount.toString(),
          status: "order-received",
          paymentStatus,
          notes: notes || null,
          paymentMethod,
        } as any)
        .returning();

      // Reduce stock for each ordered item
      for (const item of items) {
        await tx
          .update(productsTable)
          .set({
            stockQuantity: sql`GREATEST(${productsTable.stockQuantity} - ${item.quantity}, 0)`,
            inStock: sql`(${productsTable.stockQuantity} - ${item.quantity}) > 0`,
          })
          .where(eq(productsTable.id, item.productId));
      }

      await tx.insert(customerLedgerTable).values({
        customerId: customer.id,
        entryType: "order",
        description: `Online order #${order.id}`,
        debitAmount: "0.00",
        creditAmount: "0.00",
        balanceAfter: customer.creditBalance,
        metadata: {
          source: "online-order",
          orderId: order.id,
          totalAmount,
          paymentMethod,
          paymentStatus,
          paymentPendingConfirmation: paymentStatus !== "paid",
        },
      });

      if (rewardPointsEarned > 0) {
        await tx.insert(rewardTransactionsTable).values({
          customerId: customer.id,
          points: rewardPointsEarned,
          reason: `Online order #${order.id}`,
        });
      }

      return { order, customer, rewardPointsEarned };
    });

    sendTelegramMessage(formatTelegramOrderMessage({
      id: result.order.id,
      customerName: result.order.customerName,
      customerPhone: result.order.customerPhone,
      customerEmail: (result.order as any).customerEmail ?? null,
      customerAddress: result.order.customerAddress,
      totalAmount: Number(result.order.totalAmount),
      paymentMethod: result.order.paymentMethod,
      paymentStatus: (result.order as any).paymentStatus ?? "unpaid",
      notes: result.order.notes,
      items: result.order.items as Array<{ productName: string; quantity: number; price: number; unit?: string }>,
    }));

    res.status(201).json({
      ...result.order,
      totalAmount: Number(result.order.totalAmount),
      paymentStatus: (result.order as any).paymentStatus ?? "unpaid",
      customer: {
        id: result.customer.id,
        customerCode: result.customer.customerCode,
        name: result.customer.name,
        phone: result.customer.phone,
        email: (result.customer as any).email ?? null,
        address: result.customer.address,
        photoPath: result.customer.photoPath,
        rewardPoints: Number(result.customer.rewardPoints ?? 0),
      },
      rewardPointsEarned: result.rewardPointsEarned,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.get("/orders/:id/track", async (req, res) => {
  const id = Number(req.params.id);
  const phone = typeof req.query.phone === "string" ? req.query.phone.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !phone) {
    return res.status(400).json({ error: "Order ID and phone are required" });
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

    if (normalizePhone(order.customerPhone) !== normalizePhone(phone)) {
      return res.status(403).json({ error: "Phone number does not match this order" });
    }

    res.json({
      id: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: (order as any).customerEmail ?? null,
      customerAddress: order.customerAddress,
      totalAmount: Number(order.totalAmount),
      paymentMethod: order.paymentMethod,
      status: order.status,
      paymentStatus: (order as any).paymentStatus ?? "unpaid",
      notes: order.notes,
      createdAt: order.createdAt,
      items: order.items,
    });
  } catch {
    res.status(500).json({ error: "Failed to track order" });
  }
});

router.get("/customer-portal/profile", async (req, res) => {
  const customerCode = typeof req.query.customerCode === "string" ? req.query.customerCode.trim() : "";
  const phone = typeof req.query.phone === "string" ? req.query.phone.trim() : "";

  if (!customerCode || !phone) {
    return res.status(400).json({ error: "Customer code and phone are required" });
  }

  try {
    const customers = await db
      .select()
      .from(customersTable)
      .orderBy(desc(customersTable.updatedAt));

    const customer = customers.find((entry) => {
      const codeMatches = (entry.customerCode || "").trim().toUpperCase() === customerCode.toUpperCase();
      const phoneMatches = !!entry.phone && normalizePhone(entry.phone) === normalizePhone(phone);
      return codeMatches && phoneMatches;
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer profile not found" });
    }

    const [orders, invoices, payments, ledger] = await Promise.all([
      db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.customerId, customer.id))
        .orderBy(desc(ordersTable.createdAt)),
      db
        .select()
        .from(invoicesTable)
        .where(eq(invoicesTable.customerId, customer.id))
        .orderBy(desc(invoicesTable.createdAt)),
      db
        .select()
        .from(customerPaymentsTable)
        .where(eq(customerPaymentsTable.customerId, customer.id))
        .orderBy(desc(customerPaymentsTable.createdAt)),
      db
        .select()
        .from(customerLedgerTable)
        .where(eq(customerLedgerTable.customerId, customer.id))
        .orderBy(desc(customerLedgerTable.createdAt)),
    ]);

    return res.json({
      customer: {
        id: customer.id,
        customerCode: customer.customerCode,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        photoPath: customer.photoPath,
        rewardPoints: Number(customer.rewardPoints ?? 0),
        creditBalance: Number(customer.creditBalance ?? 0),
        totalSpent: Number(customer.totalSpent ?? 0),
      },
      orders: orders.map((order) => ({
        id: order.id,
        customerCode: order.customerCode,
        totalAmount: Number(order.totalAmount),
        status: order.status,
        paymentStatus: (order as any).paymentStatus ?? "unpaid",
        paymentMethod: order.paymentMethod,
        notes: order.notes,
        createdAt: order.createdAt,
        items: order.items,
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        subtotalAmount: Number(invoice.subtotalAmount),
        previousDueAmount: Number(invoice.previousDueAmount),
        totalAmount: Number(invoice.totalAmount),
        amountPaid: Number(invoice.amountPaid),
        dueAmount: Number(invoice.dueAmount),
        paymentMethod: invoice.paymentMethod,
        paymentStatus: invoice.paymentStatus,
        note: invoice.note,
        createdAt: invoice.createdAt,
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        invoiceId: payment.invoiceId,
        amount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        referenceNote: payment.referenceNote,
        createdAt: payment.createdAt,
      })),
      ledger: ledger.map((entry) => ({
        id: entry.id,
        invoiceId: entry.invoiceId,
        paymentId: entry.paymentId,
        entryType: entry.entryType,
        description: entry.description,
        debitAmount: Number(entry.debitAmount),
        creditAmount: Number(entry.creditAmount),
        balanceAfter: Number(entry.balanceAfter),
        metadata: entry.metadata,
        createdAt: entry.createdAt,
      })),
    });
  } catch {
    return res.status(500).json({ error: "Failed to load customer profile" });
  }
});

router.post("/bookings", async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.issues.map(i => i.message),
    });
  }

  try {
    const { serviceType, customerName, customerPhone, pickupLocation, destination, bookingDate, notes } = parsed.data;

    const [booking] = await db
      .insert(bookingsTable)
      .values({
        serviceType,
        customerName,
        customerPhone,
        pickupLocation,
        destination,
        bookingDate,
        status: "pending",
        notes: notes || null,
      })
      .returning();

    sendTelegramMessage(formatTelegramBookingMessage({
      id: booking.id,
      serviceType: booking.serviceType,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      pickupLocation: booking.pickupLocation,
      destination: booking.destination,
      bookingDate: booking.bookingDate,
      notes: booking.notes,
    }));

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ error: "Failed to create booking" });
  }
});

export default router;
