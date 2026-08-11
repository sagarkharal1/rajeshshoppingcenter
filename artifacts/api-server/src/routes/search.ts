import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  categoriesTable,
  ordersTable,
  bookingsTable,
  invoicesTable,
  customersTable,
  dealerTransactionsTable,
  stockLedgerTable,
} from "@workspace/db/schema";
import { ilike, or, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth.js";

const router: IRouter = Router();

interface SearchResult {
  type: "product" | "customer" | "order" | "booking" | "invoice" | "dealer";
  id: string | number;
  label: string;
  preview?: string;
  category?: string;
}

// Owner-only. This returns customer names, phone numbers and what they have
// bought; served without a login it handed the shop's customer list to anyone
// who guessed the URL. The search box lives in the owner workspace and nowhere
// else, so requiring the token costs the storefront nothing.
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }

    const searchPattern = `%${query}%`;
    const results: SearchResult[] = [];

    // Search products
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        sku: productsTable.sku,
        category: categoriesTable.name,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, sql`${productsTable.categoryId} = ${categoriesTable.id}`)
      .where(
        or(
          ilike(productsTable.name, searchPattern),
          ilike(productsTable.sku, searchPattern)
        )
      )
      .limit(10);

    results.push(
      ...products.map((p) => ({
        type: "product" as const,
        id: p.id,
        label: p.name,
        preview: p.sku || undefined,
        category: p.category || "General",
      }))
    );

    // Search customers
    const customers = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        phone: customersTable.phone,
        code: customersTable.customerCode,
      })
      .from(customersTable)
      .where(
        or(
          ilike(customersTable.name, searchPattern),
          ilike(customersTable.phone, searchPattern),
          ilike(customersTable.customerCode, searchPattern)
        )
      )
      .limit(10);

    results.push(
      ...customers.map((c) => ({
        type: "customer" as const,
        id: c.id,
        label: c.name,
        preview: c.phone || c.code || undefined,
        category: "Customer",
      }))
    );

    // Also search transport booking customers by name/phone
    const bookingCustomers = await db
      .select({
        id: bookingsTable.id,
        customerName: bookingsTable.customerName,
        customerPhone: bookingsTable.customerPhone,
        serviceType: bookingsTable.serviceType,
        paymentStatus: bookingsTable.paymentStatus,
      })
      .from(bookingsTable)
      .where(
        or(
          ilike(bookingsTable.customerName, searchPattern),
          ilike(bookingsTable.customerPhone, searchPattern)
        )
      )
      .limit(10);

    // Deduplicate by phone, only show customers not already in results
    const existingNames = new Set(results.map(r => r.label.toLowerCase()));
    const seenPhones = new Set<string>();
    for (const b of bookingCustomers) {
      const phone = b.customerPhone || "";
      if (seenPhones.has(phone) || existingNames.has(b.customerName.toLowerCase())) continue;
      seenPhones.add(phone);
      results.push({
        type: "customer" as const,
        id: `booking-${phone || b.id}`,
        label: b.customerName,
        preview: phone,
        category: "Transport Customer",
      });
    }

    // Search dealers, by name or phone. They live in two places: their own
    // table, and older records still carried in stock-ledger metadata.
    const dealerRows = await db
      .select({ name: dealerTransactionsTable.dealerName, phone: dealerTransactionsTable.dealerPhone })
      .from(dealerTransactionsTable)
      .where(
        or(
          ilike(dealerTransactionsTable.dealerName, searchPattern),
          ilike(dealerTransactionsTable.dealerPhone, searchPattern)
        )
      )
      .limit(30);

    const legacyDealers = await db
      .select({
        name: sql<string>`${stockLedgerTable.metadata}->>'dealerName'`,
        phone: sql<string>`${stockLedgerTable.metadata}->>'dealerPhone'`,
      })
      .from(stockLedgerTable)
      .where(sql`${stockLedgerTable.metadata}->>'dealerName' ilike ${searchPattern}`)
      .limit(30);

    const seenDealers = new Set<string>();
    for (const dealer of [...dealerRows, ...legacyDealers]) {
      const name = String(dealer.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenDealers.has(key)) continue;
      seenDealers.add(key);
      results.push({
        type: "dealer" as const,
        id: name,
        label: name,
        preview: dealer.phone || undefined,
        category: "Dealer",
      });
    }

    // Search orders
    const orders = await db
      .select({
        id: ordersTable.id,
        customerId: ordersTable.customerId,
        totalAmount: ordersTable.totalAmount,
        customerName: customersTable.name,
      })
      .from(ordersTable)
      .leftJoin(customersTable, sql`${ordersTable.customerId} = ${customersTable.id}`)
      .where(
        or(
          ilike(sql`CAST(${ordersTable.id} as TEXT)`, searchPattern),
          ilike(customersTable.name, searchPattern)
        )
      )
      .limit(10);

    results.push(
      ...orders.map((o) => ({
        type: "order" as const,
        id: o.id,
        label: `Order #${o.id}`,
        preview: `${o.customerName} - Rs. ${o.totalAmount}`,
        category: "Product Order",
      }))
    );

    // Search bookings
    const bookings = await db
      .select({
        id: bookingsTable.id,
        customerId: bookingsTable.customerId,
        serviceType: bookingsTable.serviceType,
        chargedAmount: bookingsTable.chargedAmount,
        customerName: bookingsTable.customerName,
        customerPhone: bookingsTable.customerPhone,
        linkedCustomerName: customersTable.name,
      })
      .from(bookingsTable)
      .leftJoin(customersTable, sql`${bookingsTable.customerId} = ${customersTable.id}`)
      .where(
        or(
          ilike(sql`CAST(${bookingsTable.id} as TEXT)`, searchPattern),
          ilike(customersTable.name, searchPattern),
          ilike(bookingsTable.customerName, searchPattern),
          ilike(bookingsTable.customerPhone, searchPattern),
          ilike(bookingsTable.serviceType, searchPattern)
        )
      )
      .limit(10);

    results.push(
      ...bookings.map((b) => ({
        type: "booking" as const,
        id: b.id,
        label: `Booking #${b.id}`,
        preview: `${b.linkedCustomerName || b.customerName} (${b.customerPhone}) - ${b.serviceType} - Rs. ${b.chargedAmount}`,
        category: "Transport Booking",
      }))
    );

    // Search invoices
    const invoices = await db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        customerId: invoicesTable.customerId,
        totalAmount: invoicesTable.totalAmount,
        customerName: customersTable.name,
      })
      .from(invoicesTable)
      .leftJoin(customersTable, sql`${invoicesTable.customerId} = ${customersTable.id}`)
      .where(
        or(
          ilike(invoicesTable.invoiceNumber, searchPattern),
          ilike(customersTable.name, searchPattern)
        )
      )
      .limit(10);

    results.push(
      ...invoices.map((i) => ({
        type: "invoice" as const,
        id: i.id,
        label: `Invoice ${i.invoiceNumber}`,
        preview: `${i.customerName} - Rs. ${i.totalAmount}`,
        category: "Invoice",
      }))
    );

    res.json({ results: results.slice(0, 50) });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
