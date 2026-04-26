import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  categoriesTable,
  ordersTable,
  bookingsTable,
  invoicesTable,
  customersTable,
} from "@workspace/db/schema";
import { ilike, or, sql } from "drizzle-orm";

const router: IRouter = Router();

interface SearchResult {
  type: "product" | "customer" | "order" | "booking" | "invoice";
  id: string | number;
  label: string;
  preview?: string;
  category?: string;
}

router.get("/", async (req: Request, res: Response) => {
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
        preview: p.sku,
        category: p.category || "General",
      }))
    );

    // Search customers
    const customers = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        phone: customersTable.phone,
        code: customersTable.code,
      })
      .from(customersTable)
      .where(
        or(
          ilike(customersTable.name, searchPattern),
          ilike(customersTable.phone, searchPattern),
          ilike(customersTable.code, searchPattern)
        )
      )
      .limit(10);

    results.push(
      ...customers.map((c) => ({
        type: "customer" as const,
        id: c.id,
        label: c.name,
        preview: c.phone || c.code,
        category: "Customer",
      }))
    );

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
        customerName: customersTable.name,
      })
      .from(bookingsTable)
      .leftJoin(customersTable, sql`${bookingsTable.customerId} = ${customersTable.id}`)
      .where(
        or(
          ilike(sql`CAST(${bookingsTable.id} as TEXT)`, searchPattern),
          ilike(customersTable.name, searchPattern),
          ilike(bookingsTable.serviceType, searchPattern)
        )
      )
      .limit(10);

    results.push(
      ...bookings.map((b) => ({
        type: "booking" as const,
        id: b.id,
        label: `Booking #${b.id}`,
        preview: `${b.customerName} - ${b.serviceType} - Rs. ${b.chargedAmount}`,
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
    res.status(500).json({
      error: "Search failed",
      details: (err as any)?.message || String(err),
    });
  }
});

export default router;
