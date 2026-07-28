import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  ordersTable,
  bookingsTable,
  invoicesTable,
  customerPaymentsTable,
  customerLedgerTable,
} from "@workspace/db/schema";
import { eq, desc, or, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

router.get("/:id/full-profile", authMiddleware, async (req: Request, res: Response) => {
  try {
    const customerId = Number(req.params.id);

    // Get customer details
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, customerId))
      .limit(1);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const phoneDigits = String(customer.phone || "").replace(/\D/g, "");
    const orderMatch = phoneDigits
      ? or(eq(ordersTable.customerId, customerId), sql`regexp_replace(${ordersTable.customerPhone}, '[^0-9]', '', 'g') = ${phoneDigits}`)
      : eq(ordersTable.customerId, customerId);
    const bookingMatch = phoneDigits
      ? or(eq(bookingsTable.customerId, customerId), sql`regexp_replace(${bookingsTable.customerPhone}, '[^0-9]', '', 'g') = ${phoneDigits}`)
      : eq(bookingsTable.customerId, customerId);

    const [orders, bookings, invoices, payments, ledgerEntries] = await Promise.all([
      db
        .select()
        .from(ordersTable)
        .where(orderMatch)
        .orderBy(desc(ordersTable.createdAt)),
      db
        .select()
        .from(bookingsTable)
        .where(bookingMatch)
        .orderBy(desc(bookingsTable.createdAt)),
      db
        .select()
        .from(invoicesTable)
        .where(eq(invoicesTable.customerId, customerId))
        .orderBy(desc(invoicesTable.createdAt)),
      db
        .select()
        .from(customerPaymentsTable)
        .where(eq(customerPaymentsTable.customerId, customerId))
        .orderBy(desc(customerPaymentsTable.createdAt)),
      db
        .select()
        .from(customerLedgerTable)
        .where(eq(customerLedgerTable.customerId, customerId))
        .orderBy(desc(customerLedgerTable.createdAt)),
    ]);

    // Calculate totals
    const orderTotal = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const invoiceTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.subtotalAmount || 0), 0);
    const bookingTotal = bookings.reduce((sum, booking) => sum + Number(booking.chargedAmount || 0), 0);

    res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      customerCode: customer.customerCode,
      code: customer.customerCode,
      address: customer.address,
      email: customer.email,
      totalSpent: Number(customer.totalSpent || 0) || orderTotal + invoiceTotal + bookingTotal,
      rewardPoints: Number(customer.rewardPoints || 0),
      creditBalance: Number(customer.creditBalance || 0),
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        totalAmount: Number(order.totalAmount || 0),
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        customerName: customer.name,
        items: (order.items as any) || [],
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        subtotalAmount: Number(invoice.subtotalAmount || 0),
        previousDueAmount: Number(invoice.previousDueAmount || 0),
        totalAmount: Number(invoice.totalAmount || 0),
        amountPaid: Number(invoice.amountPaid || 0),
        dueAmount: Number(invoice.dueAmount || 0),
        paymentStatus: invoice.paymentStatus,
        paymentMethod: invoice.paymentMethod,
        createdAt: invoice.createdAt,
        note: invoice.note,
        proofPath: (invoice as any).proofPath || null,
      })),
      bookings: bookings.map((booking) => ({
        id: booking.id,
        status: booking.status,
        serviceType: booking.serviceType,
        chargedAmount: Number(booking.chargedAmount || 0),
        amountPaid: Number(booking.amountPaid || 0),
        paymentMethod: booking.paymentMethod,
        pickupLocation: booking.pickupLocation,
        destination: booking.destination,
        bookingDate: booking.bookingDate,
        customerName: customer.name,
        proofPath: (booking as any).proofPath || null,
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount || 0),
        method: payment.paymentMethod,
        date: payment.createdAt,
        createdAt: payment.createdAt,
        referenceNote: payment.referenceNote,
        proofPath: (payment as any).proofPath || null,
      })),
      ledgerEntries: ledgerEntries.map((entry) => ({
        id: entry.id,
        date: entry.createdAt,
        type: Number(entry.creditAmount || 0) > 0 ? "credit" : "debit",
        amount: Math.max(Number(entry.debitAmount || 0), Number(entry.creditAmount || 0)),
        reason: entry.description,
        createdAt: entry.createdAt,
        entryType: entry.entryType,
        description: entry.description,
        debitAmount: Number(entry.debitAmount || 0),
        creditAmount: Number(entry.creditAmount || 0),
        balanceAfter: Number(entry.balanceAfter || 0),
        invoiceId: entry.invoiceId,
        paymentId: entry.paymentId,
        metadata: entry.metadata,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch customer profile:", err);
    res.status(500).json({ error: "Failed to fetch customer profile" });
  }
});

export default router;
