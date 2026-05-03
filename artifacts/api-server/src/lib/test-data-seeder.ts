import { db } from "@workspace/db";
import {
  customersTable,
  ordersTable,
  productsTable,
  bookingsTable,
  stockLedgerTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const NEPALI_FIRST_NAMES = [
  "Sagar", "Ramesh", "Suresh", "Ashok", "Rajesh", "Niresh", "Dinesh", "Mithun",
  "Pradeep", "Sandeep", "Anand", "Varun", "Arjun", "Ravi", "Shyam", "Bikram",
  "Anil", "Rajendra", "Govind", "Hari", "Kiran", "Deepak", "Rohit", "Mohan",
  "Mahesh", "Santosh", "Prakash", "Vijay", "Roshan", "Sunny", "Shailendra",
];

const NEPALI_LAST_NAMES = [
  "Kharal", "Gurung", "Tamang", "Sharma", "Poudel", "Thapa", "Rai", "Lamichhane",
  "Bista", "KC", "Koirala", "Shrestha", "Neupane", "Acharya", "Pradhan", "Joshi",
  "Ghimire", "Karki", "Pandey", "Singh", "Verma", "Kumari", "Chhetri", "Dhakal",
  "Bhattarai", "Mukhiya", "Magar", "Limbu", "Sunwar", "Subedi",
];

const NEPALI_LOCATIONS = [
  "Anpchaur", "Itahari", "Dharan", "Biratnagar", "Sundarharaicha", "Damak",
  "Urlabari", "Sunsari", "Inaruwa", "Jhapa", "Ilam", "Udayapur", "Katahari",
];

const SERVICE_TYPES = ["jeep", "tractor", "telcoline"] as const;
const PAYMENT_METHODS = ["cash", "esewa", "khalti", "bank"] as const;

interface TestDataOptions {
  customerCount?: number;
  orderCount?: number;
  bookingCount?: number;
  daysBack?: number;
}

export async function seedTestData(options: TestDataOptions) {
  const {
    customerCount = 50,
    orderCount = 200,
    bookingCount = 100,
    daysBack = 90,
  } = options;

  const created = {
    customers: 0,
    orders: 0,
    bookings: 0,
  };

  try {
    // Get all products for order generation
    const products = await db.select().from(productsTable).limit(20);
    if (products.length === 0) {
      throw new Error("No products found. Please create products first.");
    }

    // Create test customers
    const customers: any[] = [];
    for (let i = 0; i < customerCount; i++) {
      const firstName = NEPALI_FIRST_NAMES[Math.floor(Math.random() * NEPALI_FIRST_NAMES.length)];
      const lastName = NEPALI_LAST_NAMES[Math.floor(Math.random() * NEPALI_LAST_NAMES.length)];
      const customerCode = `TEST-${String(i + 1).padStart(5, "0")}`;

      const phone = `98${String(Math.floor(Math.random() * 100000000)).padStart(8, "0")}`;
      const location = NEPALI_LOCATIONS[Math.floor(Math.random() * NEPALI_LOCATIONS.length)];

      const [customer] = await db
        .insert(customersTable)
        .values({
          name: `${firstName} ${lastName}`,
          phone,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@test.rajesh`,
          address: `${location}, Nepal`,
          customerCode,
          totalSpent: "0",
          rewardPoints: 0,
          creditBalance: "0",
          notes: "Test customer",
        } as any)
        .returning();

      if (customer) {
        customers.push(customer);
        created.customers++;
      }
    }

    // Create test orders
    for (let i = 0; i < orderCount; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      if (!customer) continue;

      const daysAgo = Math.floor(Math.random() * daysBack);
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - daysAgo);

      const itemCount = Math.floor(Math.random() * 4) + 1;
      const items: any[] = [];
      let totalAmount = 0;

      for (let j = 0; j < itemCount; j++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 10) + 1;
        const itemTotal = Number(product.price) * quantity;
        totalAmount += itemTotal;

        items.push({
          productId: product.id,
          productName: product.name,
          price: Number(product.price),
          quantity,
          unit: product.unit,
        });
      }

      const paymentStatus = Math.random() > 0.3 ? "paid" : "unpaid";
      const paymentMethod = PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)];

      const [order] = await db
        .insert(ordersTable)
        .values({
          customerId: customer.id,
          customerCode: customer.customerCode,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          customerAddress: customer.address,
          items,
          totalAmount: totalAmount.toFixed(2),
          paymentStatus,
          paymentMethod,
          status: Math.random() > 0.1 ? "delivered" : "order-received",
          notes: "Test order",
          createdAt: orderDate,
        } as any)
        .returning();

      if (order) {
        // Create stock ledger entries for each item
        for (const item of items) {
          const [product] = await db
            .select({ stockQuantity: productsTable.stockQuantity })
            .from(productsTable)
            .where(eq(productsTable.id, item.productId));

          if (product) {
            const balanceBefore = product.stockQuantity || 0;
            const balanceAfter = Math.max(balanceBefore - item.quantity, 0);

            await db.insert(stockLedgerTable).values({
              productId: item.productId,
              transactionType: "order",
              quantity: -item.quantity,
              reason: `Sold via test order #${order.id}`,
              linkedEntityType: "order",
              linkedEntityId: order.id,
              balanceBefore,
              balanceAfter,
              createdAt: orderDate,
              metadata: {
                productName: item.productName,
                customerName: customer.name,
                customerPhone: customer.phone,
                testData: true,
              },
            });
          }
        }

        created.orders++;
      }
    }

    // Create test bookings
    for (let i = 0; i < bookingCount; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      if (!customer) continue;

      const daysAgo = Math.floor(Math.random() * daysBack);
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() - daysAgo);

      const pickupLocations = NEPALI_LOCATIONS;
      const destinationLocations = NEPALI_LOCATIONS;

      const pickupLocation = pickupLocations[Math.floor(Math.random() * pickupLocations.length)];
      let destination = destinationLocations[Math.floor(Math.random() * destinationLocations.length)];
      while (destination === pickupLocation && destinationLocations.length > 1) {
        destination = destinationLocations[Math.floor(Math.random() * destinationLocations.length)];
      }

      const serviceType = SERVICE_TYPES[Math.floor(Math.random() * SERVICE_TYPES.length)];
      const chargedAmount = Math.floor(Math.random() * 10000) + 2000;
      const amountPaid = Math.random() > 0.2 ? chargedAmount : Math.floor(chargedAmount * 0.5);
      const paymentStatus = amountPaid >= chargedAmount ? "paid" : "unpaid";
      const paymentMethod = PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)];

      const [booking] = await db
        .insert(bookingsTable)
        .values({
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          pickupLocation,
          destination,
          bookingDate: bookingDate.toISOString().split("T")[0],
          serviceType,
          chargedAmount: chargedAmount.toString(),
          amountPaid: amountPaid.toString(),
          paymentMethod,
          paymentStatus,
          status: Math.random() > 0.2 ? "completed" : "pending",
          notes: "Test booking",
          createdAt: bookingDate,
        } as any)
        .returning();

      if (booking) {
        created.bookings++;
      }
    }

    return created;
  } catch (error) {
    console.error("Test data seeding error:", error);
    throw error;
  }
}

export async function clearTestData() {
  const cleared = {
    orders: 0,
    bookings: 0,
    customers: 0,
    stockLedgers: 0,
  };

  try {
    // Find test data (marked with @test.rajesh email or TEST- customer code)
    const testCustomers = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(
        `${customersTable.customerCode} LIKE 'TEST-%' OR ${customersTable.email} LIKE '%@test.rajesh'` as any
      );

    const testCustomerIds = testCustomers.map((c: any) => c.id);

    if (testCustomerIds.length > 0) {
      // Delete test orders
      const testOrders = await db
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(`${ordersTable.customerId} IN (${testCustomerIds.join(",")})` as any);

      const testOrderIds = testOrders.map((o: any) => o.id);

      // Delete stock ledger entries from test orders
      for (const orderId of testOrderIds) {
        const result = await db
          .delete(stockLedgerTable)
          .where(`${stockLedgerTable.linkedEntityId} = ${orderId}` as any);
        cleared.stockLedgers += Number((result as any)?.rowCount ?? 0);
      }

      // Delete test orders
      cleared.orders = testOrderIds.length;
      for (const orderId of testOrderIds) {
        await db.delete(ordersTable).where(`${ordersTable.id} = ${orderId}` as any);
      }

      // Delete test bookings
      const testBookings = await db
        .select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(`${bookingsTable.customerId} IN (${testCustomerIds.join(",")})` as any);

      cleared.bookings = testBookings.length;
      for (const booking of testBookings) {
        await db.delete(bookingsTable).where(`${bookingsTable.id} = ${booking.id}` as any);
      }

      // Delete test customers
      cleared.customers = testCustomerIds.length;
      for (const customerId of testCustomerIds) {
        await db.delete(customersTable).where(`${customersTable.id} = ${customerId}` as any);
      }
    }

    return cleared;
  } catch (error) {
    console.error("Clear test data error:", error);
    throw error;
  }
}

export async function getTestDataStatus() {
  try {
    const testCustomers = await db
      .select({ id: customersTable.id, totalSpent: customersTable.totalSpent })
      .from(customersTable)
      .where(
        `${customersTable.customerCode} LIKE 'TEST-%' OR ${customersTable.email} LIKE '%@test.rajesh'` as any
      );

    const testOrders = await db
      .select({ id: ordersTable.id, totalAmount: ordersTable.totalAmount })
      .from(ordersTable)
      .where(`${ordersTable.customerCode} LIKE 'TEST-%'` as any);

    const testBookings = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(`${bookingsTable.customerName} IN (SELECT name FROM customers WHERE customerCode LIKE 'TEST-%')` as any);

    const totalSpent = testOrders.reduce((sum, o: any) => sum + Number(o.totalAmount || 0), 0);

    return {
      customers: testCustomers.length,
      orders: testOrders.length,
      bookings: testBookings.length,
      totalSpent: totalSpent.toFixed(2),
    };
  } catch (error) {
    console.error("Get test data status error:", error);
    throw error;
  }
}
