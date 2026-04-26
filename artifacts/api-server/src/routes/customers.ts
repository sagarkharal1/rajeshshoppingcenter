import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  customersTable,
  ordersTable,
  bookingsTable,
  customerPaymentsTable,
  customerLedgerTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/:id/full-profile", async (req: Request, res: Response) => {
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

    // Get all orders for this customer
    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.customerId, customerId))
      .orderBy(desc(ordersTable.createdAt));

    // Get all bookings for this customer
    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.customerId, customerId))
      .orderBy(desc(bookingsTable.bookingDate));

    // Get all payments for this customer
    const payments = await db
      .select()
      .from(customerPaymentsTable)
      .where(eq(customerPaymentsTable.customerId, customerId))
      .orderBy(desc(customerPaymentsTable.paymentDate));

    // Get ledger entries for this customer
    const ledgerEntries = await db
      .select()
      .from(customerLedgerTable)
      .where(eq(customerLedgerTable.customerId, customerId))
      .orderBy(desc(customerLedgerTable.date));

    // Calculate totals
    const totalSpent = orders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0
    );

    res.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      code: customer.code,
      address: customer.address,
      email: customer.email,
      totalSpent,
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
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount || 0),
        method: payment.paymentMethod,
        date: payment.paymentDate,
        referenceNote: payment.referenceNote,
      })),
      ledgerEntries: ledgerEntries.map((entry) => ({
        date: entry.date,
        type: entry.type === "credit" ? "credit" : "debit",
        amount: Number(entry.amount || 0),
        reason: entry.reason,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch customer profile:", err);
    res.status(500).json({
      error: "Failed to fetch customer profile",
      details: (err as any)?.message || String(err),
    });
  }
});

export default router;
