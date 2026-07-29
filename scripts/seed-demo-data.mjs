#!/usr/bin/env node
/**
 * Fills the shop with realistic demo data so the app can be exercised the way
 * it will actually be used — before the real business data goes in.
 *
 * Everything is created through the normal admin API, so stock, credit
 * balances, ledgers, and reward points are calculated by the real code paths
 * rather than written straight into the database.
 *
 * Usage:
 *   API_BASE=https://rajeshshoppingcenter.com.np \
 *   ADMIN_USER=owner ADMIN_PASSWORD='your-password' \
 *   node scripts/seed-demo-data.mjs
 *
 * Optional: ADMIN_TOTP=123456   (only if Google Authenticator is enabled)
 *
 * Remove all of it afterwards with the red Danger zone box at the bottom of
 * the owner "Media & updates" tab. Prices are typical Gulmi-area retail
 * figures and are meant as plausible placeholders — adjust before treating
 * any as real.
 */

const API_BASE = (process.env.API_BASE || "https://rajeshshoppingcenter.com.np").replace(/\/+$/, "");
const ADMIN_USER = process.env.ADMIN_USER || "owner";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_TOTP = process.env.ADMIN_TOTP;

if (!ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD is required.\nExample:\n  API_BASE=https://rajeshshoppingcenter.com.np ADMIN_USER=owner ADMIN_PASSWORD='...' node scripts/seed-demo-data.mjs");
  process.exit(1);
}

let token = null;

async function call(path, { method = "GET", body, auth = true } = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = data && typeof data === "object" ? data.error || JSON.stringify(data) : String(data);
    throw new Error(`${method} ${path} failed (${res.status}): ${detail}`);
  }
  return data;
}

// --- Catalogue -------------------------------------------------------------

const CATEGORIES = [
  { name: "किराना", description: "Daily grocery staples", icon: "grocery", sortOrder: 1 },
  { name: "तरकारी", description: "Fresh vegetables", icon: "vegetable", sortOrder: 2 },
  { name: "फलफूल", description: "Seasonal fruit", icon: "fruit", sortOrder: 3 },
  { name: "हार्डवेयर", description: "Hardware and construction supplies", icon: "hardware", sortOrder: 4 },
  { name: "ग्यास तथा इन्धन", description: "Cooking gas and fuel", icon: "gas", sortOrder: 5 },
  { name: "लत्ताकपडा तथा जुत्ता", description: "Clothing and footwear", icon: "clothing", sortOrder: 6 },
];

// price = selling price, buyingPrice = cost. Margins kept realistic for a
// village general store (thin on staples, wider on hardware and clothing).
const PRODUCTS = [
  // किराना
  { cat: "किराना", name: "मसिनो चामल (२५ केजी)", sku: "RICE-25", price: 2650, buyingPrice: 2380, transportationCost: 60, unit: "bora", stock: 40, reorder: 8, featured: true },
  { cat: "किराना", name: "जिरा मसिनो चामल (५ केजी)", sku: "RICE-05", price: 620, buyingPrice: 545, transportationCost: 15, unit: "packet", stock: 60, reorder: 12 },
  { cat: "किराना", name: "मुसुरो दाल (१ केजी)", sku: "DAL-MSR", price: 210, buyingPrice: 178, unit: "kg", stock: 85, reorder: 15, featured: true },
  { cat: "किराना", name: "रहर दाल (१ केजी)", sku: "DAL-RHR", price: 245, buyingPrice: 208, unit: "kg", stock: 50, reorder: 10 },
  { cat: "किराना", name: "तोरीको तेल (१ लिटर)", sku: "OIL-MST", price: 340, buyingPrice: 292, unit: "litre", stock: 70, reorder: 15, featured: true },
  { cat: "किराना", name: "सूर्यमुखी तेल (१ लिटर)", sku: "OIL-SUN", price: 295, buyingPrice: 255, unit: "litre", stock: 45, reorder: 10 },
  { cat: "किराना", name: "चिनी (१ केजी)", sku: "SUGAR-1", price: 125, buyingPrice: 108, unit: "kg", stock: 120, reorder: 25 },
  { cat: "किराना", name: "आयोडिन नुन (१ केजी)", sku: "SALT-1", price: 32, buyingPrice: 24, unit: "kg", stock: 150, reorder: 30 },
  { cat: "किराना", name: "चिया पत्ती (५०० ग्राम)", sku: "TEA-500", price: 285, buyingPrice: 240, unit: "packet", stock: 55, reorder: 10 },
  { cat: "किराना", name: "बेसन (१ केजी)", sku: "BESAN-1", price: 165, buyingPrice: 138, unit: "kg", stock: 40, reorder: 8 },
  { cat: "किराना", name: "चाउचाउ (प्याक)", sku: "NOODLE-P", price: 25, buyingPrice: 19, unit: "piece", stock: 300, reorder: 60 },
  { cat: "किराना", name: "बिस्कुट (प्याक)", sku: "BISC-P", price: 45, buyingPrice: 34, unit: "piece", stock: 180, reorder: 40 },

  // तरकारी
  { cat: "तरकारी", name: "आलु (१ केजी)", sku: "VEG-ALU", price: 75, buyingPrice: 58, unit: "kg", stock: 200, reorder: 40, featured: true },
  { cat: "तरकारी", name: "प्याज (१ केजी)", sku: "VEG-PYJ", price: 110, buyingPrice: 88, unit: "kg", stock: 150, reorder: 30 },
  { cat: "तरकारी", name: "गोलभेडा (१ केजी)", sku: "VEG-TMT", price: 90, buyingPrice: 68, unit: "kg", stock: 80, reorder: 20 },
  { cat: "तरकारी", name: "काउली (१ केजी)", sku: "VEG-CFL", price: 85, buyingPrice: 62, unit: "kg", stock: 60, reorder: 15 },
  { cat: "तरकारी", name: "बन्दा (१ केजी)", sku: "VEG-CBG", price: 70, buyingPrice: 50, unit: "kg", stock: 65, reorder: 15 },
  { cat: "तरकारी", name: "अदुवा (१ केजी)", sku: "VEG-GNG", price: 260, buyingPrice: 215, unit: "kg", stock: 30, reorder: 8 },

  // फलफूल
  { cat: "फलफूल", name: "स्याउ (१ केजी)", sku: "FRT-APL", price: 320, buyingPrice: 265, unit: "kg", stock: 45, reorder: 10, featured: true },
  { cat: "फलफूल", name: "केरा (दर्जन)", sku: "FRT-BAN", price: 180, buyingPrice: 145, unit: "dozen", stock: 40, reorder: 10 },
  { cat: "फलफूल", name: "सुन्तला (१ केजी)", sku: "FRT-ORG", price: 210, buyingPrice: 170, unit: "kg", stock: 35, reorder: 8 },

  // हार्डवेयर
  { cat: "हार्डवेयर", name: "सिमेन्ट (५० केजी बोरा)", sku: "HW-CEM", price: 1050, buyingPrice: 920, transportationCost: 45, unit: "bora", stock: 60, reorder: 15, featured: true },
  { cat: "हार्डवेयर", name: "डन्डी १२ एमएम (प्रति केजी)", sku: "HW-ROD12", price: 128, buyingPrice: 110, unit: "kg", stock: 400, reorder: 80 },
  { cat: "हार्डवेयर", name: "जिआई पाइप १/२ इन्च (फिट)", sku: "HW-PIPE", price: 145, buyingPrice: 118, unit: "piece", stock: 90, reorder: 20 },
  { cat: "हार्डवेयर", name: "पेन्ट (४ लिटर)", sku: "HW-PNT4", price: 1850, buyingPrice: 1520, unit: "piece", stock: 25, reorder: 5 },
  { cat: "हार्डवेयर", name: "किला (१ केजी)", sku: "HW-NAIL", price: 165, buyingPrice: 128, unit: "kg", stock: 70, reorder: 15 },

  // ग्यास
  { cat: "ग्यास तथा इन्धन", name: "एलपी ग्यास सिलिन्डर (रिफिल)", sku: "GAS-REF", price: 1910, buyingPrice: 1795, transportationCost: 40, unit: "piece", stock: 35, reorder: 8, featured: true },
  { cat: "ग्यास तथा इन्धन", name: "मट्टितेल (१ लिटर)", sku: "GAS-KER", price: 150, buyingPrice: 128, unit: "litre", stock: 50, reorder: 12 },

  // लत्ताकपडा
  { cat: "लत्ताकपडा तथा जुत्ता", name: "स्कूल जुत्ता (जोर)", sku: "CL-SHOE", price: 1250, buyingPrice: 940, unit: "piece", stock: 30, reorder: 6 },
  { cat: "लत्ताकपडा तथा जुत्ता", name: "चप्पल (जोर)", sku: "CL-SLP", price: 380, buyingPrice: 265, unit: "piece", stock: 65, reorder: 15 },
  { cat: "लत्ताकपडा तथा जुत्ता", name: "गम बुट (जोर)", sku: "CL-BOOT", price: 890, buyingPrice: 665, unit: "piece", stock: 28, reorder: 6 },
];

// --- People ----------------------------------------------------------------

const CUSTOMERS = [
  { name: "राम बहादुर थापा", phone: "9857041201", address: "मुसिकोट–५, आपचौर, गुल्मी" },
  { name: "सीता कुमारी पौडेल", phone: "9857041202", address: "मुसिकोट–४, गुल्मी" },
  { name: "हरि प्रसाद शर्मा", phone: "9857041203", address: "रेसुङ्गा–७, गुल्मी" },
  { name: "गीता देवी खरेल", phone: "9857041204", address: "मुसिकोट–५, आपचौर, गुल्मी" },
  { name: "बुद्धि बहादुर गुरुङ", phone: "9857041205", address: "इस्मा–३, गुल्मी" },
  { name: "कमला अधिकारी", phone: "9857041206", address: "मुसिकोट–६, गुल्मी" },
  { name: "दीपक कुमार न्यौपाने", phone: "9857041207", address: "रेसुङ्गा–२, गुल्मी" },
  { name: "लक्ष्मी बुढाथोकी", phone: "9857041208", address: "मालिका–४, गुल्मी" },
  { name: "नारायण प्रसाद भट्टराई", phone: "9857041209", address: "मुसिकोट–५, गुल्मी" },
  { name: "सरस्वती के.सी.", phone: "9857041210", address: "छत्रकोट–१, गुल्मी" },
  { name: "टेक बहादुर मगर", phone: "9857041211", address: "गुल्मी दरबार–३" },
  { name: "पार्वती ज्ञवाली", phone: "9857041212", address: "मुसिकोट–७, गुल्मी" },
];

const DEALERS = [
  { dealerName: "बुटवल होलसेल सप्लायर्स", dealerPhone: "9857031101" },
  { dealerName: "सन्देश हार्डवेयर एण्ड सप्लायर्स", dealerPhone: "9857031102" },
  { dealerName: "पाल्पा ट्रेडर्स", dealerPhone: "9857031103" },
  { dealerName: "गुल्मी ग्यास डिपो", dealerPhone: "9857031104" },
];

const LOCATIONS = ["आपचौर", "तम्घास", "रेसुङ्गा", "सुनुवाल", "वामीटक्सार", "इस्मा", "मालिका", "बुटवल"];

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const daysAgoIso = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
};

async function main() {
  console.log(`Seeding demo data into ${API_BASE}\n`);

  // 1. Log in
  const login = await call("/admin/login", {
    method: "POST",
    auth: false,
    body: { identifier: ADMIN_USER, password: ADMIN_PASSWORD, ...(ADMIN_TOTP ? { totp: ADMIN_TOTP } : {}) },
  });
  token = login.token;
  if (!token) throw new Error("Login succeeded but no token was returned.");
  console.log("✓ Logged in as owner");

  // 2. Categories
  const categoryIds = {};
  for (const category of CATEGORIES) {
    const created = await call("/admin/categories", { method: "POST", body: category });
    categoryIds[category.name] = created.id ?? created.category?.id;
  }
  console.log(`✓ ${CATEGORIES.length} categories`);

  // 3. Products
  const products = [];
  for (const item of PRODUCTS) {
    const created = await call("/admin/products", {
      method: "POST",
      body: {
        name: item.name,
        description: `${item.name} — demo stock`,
        sku: item.sku,
        price: item.price,
        buyingPrice: item.buyingPrice,
        transportationCost: item.transportationCost ?? 0,
        extraCost: 0,
        stockQuantity: item.stock,
        reorderLevel: item.reorder,
        unit: item.unit,
        categoryId: categoryIds[item.cat],
        inStock: true,
        featured: Boolean(item.featured),
      },
    });
    products.push({ ...item, id: created.id ?? created.product?.id });
  }
  console.log(`✓ ${products.length} products`);

  // 4. Customers
  const customers = [];
  for (const customer of CUSTOMERS) {
    const created = await call("/admin/customers", {
      method: "POST",
      body: { ...customer, notes: "Demo customer" },
    });
    customers.push(created);
  }
  console.log(`✓ ${customers.length} customers`);

  // 5. Dealer purchases — stock arriving from suppliers, some part-paid
  let dealerEntries = 0;
  for (const dealer of DEALERS) {
    for (let i = 0; i < 3; i++) {
      const product = pick(products);
      const quantity = 20 + rand(40);
      const billAmount = quantity * product.buyingPrice;
      const paidAmount = Math.random() > 0.4 ? billAmount : Math.round(billAmount * 0.6);
      await call(`/admin/products/${product.id}/adjust-stock`, {
        method: "PUT",
        body: {
          quantity,
          transactionType: "purchase",
          reason: `${dealer.dealerName} बाट सामान आयो`,
          dealerName: dealer.dealerName,
          dealerPhone: dealer.dealerPhone,
          billNumber: `BILL-${1000 + rand(9000)}`,
          billAmount,
          paidAmount,
        },
      });
      dealerEntries++;
    }
  }
  console.log(`✓ ${dealerEntries} dealer purchases (some with amounts still owed)`);

  // 6. Shop sales — a mix of fully paid and udharo (credit)
  let invoices = 0;
  let creditInvoices = 0;
  for (const customer of customers) {
    const salesForCustomer = 1 + rand(3);
    for (let i = 0; i < salesForCustomer; i++) {
      const lineCount = 1 + rand(4);
      const items = [];
      const used = new Set();
      for (let j = 0; j < lineCount; j++) {
        const product = pick(products);
        if (used.has(product.id)) continue;
        used.add(product.id);
        items.push({ productId: product.id, quantity: 1 + rand(4) });
      }
      if (items.length === 0) continue;

      const subtotal = items.reduce((sum, line) => {
        const product = products.find((p) => p.id === line.productId);
        return sum + product.price * line.quantity;
      }, 0);

      // ~35% of sales go on credit, which is how a village shop actually runs
      const onCredit = Math.random() < 0.35;
      const amountPaid = onCredit ? Math.round(subtotal * (Math.random() < 0.5 ? 0 : 0.5)) : subtotal;

      await call("/admin/invoices", {
        method: "POST",
        body: {
          customerId: customer.id,
          items,
          paymentMethod: onCredit ? "credit" : pick(["cash", "cash", "esewa", "khalti"]),
          amountPaid,
          note: onCredit ? "उधारो बिक्री (demo)" : "नगद बिक्री (demo)",
        },
      });
      invoices++;
      if (onCredit) creditInvoices++;
    }
  }
  console.log(`✓ ${invoices} shop sales (${creditInvoices} on udharo/credit)`);

  // 7. Repayments against outstanding credit
  let payments = 0;
  const withDues = await call("/admin/customers");
  const dueList = (Array.isArray(withDues) ? withDues : withDues.customers || []).filter(
    (c) => Number(c.creditBalance || 0) > 0,
  );
  for (const customer of dueList) {
    if (Math.random() < 0.5) continue;
    const balance = Number(customer.creditBalance);
    const amount = Math.max(100, Math.round(balance * (Math.random() < 0.5 ? 0.5 : 1)));
    await call("/admin/payments", {
      method: "POST",
      body: {
        customerId: customer.id,
        amount,
        paymentMethod: pick(["cash", "cash", "esewa", "bank"]),
        referenceNote: "उधारो फिर्ता (demo)",
      },
    });
    payments++;
  }
  console.log(`✓ ${payments} credit repayments`);

  // 8. Transport bookings (jeep / tractor)
  let bookings = 0;
  for (let i = 0; i < 14; i++) {
    const customer = pick(CUSTOMERS);
    let pickup = pick(LOCATIONS);
    let destination = pick(LOCATIONS);
    while (destination === pickup) destination = pick(LOCATIONS);

    await call("/bookings", {
      method: "POST",
      auth: false,
      body: {
        serviceType: pick(["jeep", "jeep", "tractor"]),
        customerName: customer.name,
        customerPhone: customer.phone,
        pickupLocation: pickup,
        destination,
        bookingDate: daysAgoIso(rand(30)),
        notes: "Demo booking",
      },
    });
    bookings++;
  }
  console.log(`✓ ${bookings} transport bookings`);

  console.log(`
Done. The shop now has a full month of realistic activity to test against.

Things worth trying:
  • Reports tab — sales, profit, dealer dues, credit outstanding
  • Customers — open one with udharo, record a payment, then void it
  • Billing — try the "New / unknown customer" cash sale
  • Products — check low-stock warnings and stock history
  • Bookings — confirm one and collect payment

When you are finished, remove all of it with:
  Owner area → Media & updates tab → red Danger zone box → type DELETE ALL DATA
`);
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`);
  process.exit(1);
});
