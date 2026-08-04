/**
 * Money-path integration tests against a real Postgres engine (PGlite).
 *
 * Each test replays the exact SQL and arithmetic from the API handlers so the
 * behaviour being checked is the behaviour that ships:
 *   - POST /admin/orders/:id/settle   (confirmed / credit, partial-aware)
 *   - POST /admin/invoices/:id/void
 *   - POST /admin/payments/:id/void
 *   - recalculateCustomerBalance()
 *   - dashboard confirmedRevenue / pendingPayment
 *   - walk-in credit guard
 */
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

await db.exec(`
CREATE TABLE customers (
  id serial PRIMARY KEY, name text NOT NULL, customer_code text,
  reward_points integer NOT NULL DEFAULT 0,
  credit_balance numeric(12,2) NOT NULL DEFAULT 0,
  total_spent numeric(12,2) NOT NULL DEFAULT 0
);
CREATE TABLE products (
  id serial PRIMARY KEY, name text NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0, in_stock boolean NOT NULL DEFAULT true,
  price numeric(10,2) NOT NULL DEFAULT 0
);
CREATE TABLE orders (
  id serial PRIMARY KEY, customer_id integer,
  customer_name text NOT NULL, total_amount numeric(10,2) NOT NULL,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'order-received',
  payment_status text NOT NULL DEFAULT 'unpaid',
  payment_method text NOT NULL DEFAULT 'bank'
);
CREATE TABLE invoices (
  id serial PRIMARY KEY, customer_id integer NOT NULL, invoice_number text NOT NULL,
  subtotal_amount numeric(12,2) NOT NULL, amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  due_amount numeric(12,2) NOT NULL DEFAULT 0,
  reward_points_earned integer NOT NULL DEFAULT 0,
  voided_at timestamp, void_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invoice_items (
  id serial PRIMARY KEY, invoice_id integer NOT NULL,
  product_id integer NOT NULL, product_name text NOT NULL, quantity integer NOT NULL,
  unit text NOT NULL DEFAULT 'piece',
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  -- Cost as it was when the item sold, so later price changes cannot
  -- retroactively rewrite what past sales earned.
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);
CREATE TABLE customer_payments (
  id serial PRIMARY KEY, customer_id integer NOT NULL, invoice_id integer,
  amount numeric(12,2) NOT NULL, payment_method text NOT NULL DEFAULT 'cash',
  reference_note text, voided_at timestamp, void_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customer_ledger (
  id serial PRIMARY KEY, customer_id integer NOT NULL, invoice_id integer, payment_id integer,
  entry_type text NOT NULL, description text NOT NULL,
  debit_amount numeric(12,2) NOT NULL DEFAULT 0,
  credit_amount numeric(12,2) NOT NULL DEFAULT 0,
  balance_after numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb
);
`);

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const num = (v) => Number(v ?? 0);

// ── mirrors recalculateCustomerBalance() in business.ts ────────────────────
async function recalcBalance(customerId) {
  const billed = await one(
    `SELECT coalesce(sum(subtotal_amount) filter (where voided_at is null), 0) AS v
     FROM invoices WHERE customer_id = $1`, [customerId]);
  const paid = await one(
    `SELECT coalesce(sum(amount) filter (where voided_at is null), 0) AS v
     FROM customer_payments WHERE customer_id = $1`, [customerId]);
  const balance = Math.max(num(billed.v) - num(paid.v), 0);
  await q(`UPDATE customers SET credit_balance = $1 WHERE id = $2`, [balance.toFixed(2), customerId]);
  return balance;
}

// ── mirrors POST /admin/orders/:id/settle ──────────────────────────────────
async function settleOrder(orderId, action, paymentMethod = "cash") {
  const order = await one(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  const customer = await one(`SELECT * FROM customers WHERE id = $1`, [order.customer_id]);
  if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

  const totalAmount = num(order.total_amount);
  const currentBalance = num(customer.credit_balance);
  const alreadyPaid = num(order.amount_paid);
  const remainingDue = Math.max(totalAmount - alreadyPaid, 0);
  if (remainingDue <= 0) throw new Error("ALREADY_PAID");

  if (action === "confirmed") {
    await q(`UPDATE orders SET payment_status='paid', status='delivered', amount_paid=$1 WHERE id=$2`,
      [totalAmount.toFixed(2), orderId]);
    const payment = await one(
      `INSERT INTO customer_payments (customer_id, amount, payment_method, reference_note)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [customer.id, remainingDue.toFixed(2), paymentMethod, `Online order #${orderId} — confirmed`]);
    await q(
      `INSERT INTO customer_ledger (customer_id, payment_id, entry_type, description, debit_amount, credit_amount, balance_after, metadata)
       VALUES ($1,$2,'payment',$3,'0.00',$4,$5,$6)`,
      [customer.id, payment.id, `Online order #${orderId}`, remainingDue.toFixed(2),
       currentBalance.toFixed(2), JSON.stringify({ source: "order-payment-confirm", orderId })]);
    return { recorded: remainingDue };
  }

  const existing = await one(
    `SELECT id FROM customer_ledger
     WHERE customer_id=$1 AND entry_type='order-credit' AND metadata->>'orderId' = $2 LIMIT 1`,
    [customer.id, String(orderId)]);
  if (existing) throw new Error("ALREADY_CREDITED");

  const newBalance = currentBalance + remainingDue;
  await q(`UPDATE orders SET status='delivered' WHERE id=$1`, [orderId]);
  await q(`UPDATE customers SET credit_balance=$1 WHERE id=$2`, [newBalance.toFixed(2), customer.id]);
  await q(
    `INSERT INTO customer_ledger (customer_id, entry_type, description, debit_amount, credit_amount, balance_after, metadata)
     VALUES ($1,'order-credit',$2,$3,'0.00',$4,$5)`,
    [customer.id, `Online order #${orderId} — added to credit tab`, remainingDue.toFixed(2),
     newBalance.toFixed(2), JSON.stringify({ source: "order-credit", orderId })]);
  return { credited: remainingDue };
}

// ── mirrors POST /admin/invoices/:id/void ──────────────────────────────────
async function voidInvoice(invoiceId, reason) {
  const inv = await one(`SELECT * FROM invoices WHERE id=$1`, [invoiceId]);
  if (!inv) throw new Error("INVOICE_NOT_FOUND");
  if (inv.voided_at) throw new Error("ALREADY_VOIDED");

  const items = await q(`SELECT * FROM invoice_items WHERE invoice_id=$1`, [invoiceId]);
  for (const it of items) {
    await q(`UPDATE products SET stock_quantity = stock_quantity + $1,
             in_stock = (stock_quantity + $1) > 0 WHERE id=$2`, [it.quantity, it.product_id]);
  }
  await q(`UPDATE customer_payments SET voided_at=now(), void_reason=$1
           WHERE invoice_id=$2 AND voided_at is null`, [`Invoice voided`, invoiceId]);
  await q(`UPDATE invoices SET voided_at=now(), void_reason=$1 WHERE id=$2`, [reason, invoiceId]);

  const cust = await one(`SELECT * FROM customers WHERE id=$1`, [inv.customer_id]);
  if (cust) {
    const points = Math.max(Number(cust.reward_points) - Number(inv.reward_points_earned), 0);
    const spend = Math.max(num(cust.total_spent) - num(inv.subtotal_amount), 0);
    await q(`UPDATE customers SET reward_points=$1, total_spent=$2 WHERE id=$3`,
      [points, spend.toFixed(2), cust.id]);
  }
  const balance = await recalcBalance(inv.customer_id);
  await q(
    `INSERT INTO customer_ledger (customer_id, invoice_id, entry_type, description, debit_amount, credit_amount, balance_after, metadata)
     VALUES ($1,$2,'void',$3,'0.00',$4,$5,$6)`,
    [inv.customer_id, invoiceId, `Invoice ${inv.invoice_number} voided: ${reason}`,
     num(inv.subtotal_amount).toFixed(2), balance.toFixed(2), JSON.stringify({ reason })]);
  return balance;
}

// ── mirrors POST /admin/payments/:id/void ──────────────────────────────────
async function voidPayment(paymentId, reason) {
  const p = await one(`SELECT * FROM customer_payments WHERE id=$1`, [paymentId]);
  if (!p) throw new Error("PAYMENT_NOT_FOUND");
  if (p.voided_at) throw new Error("ALREADY_VOIDED");
  await q(`UPDATE customer_payments SET voided_at=now(), void_reason=$1 WHERE id=$2`, [reason, paymentId]);
  const balance = await recalcBalance(p.customer_id);
  await q(
    `INSERT INTO customer_ledger (customer_id, payment_id, entry_type, description, debit_amount, credit_amount, balance_after, metadata)
     VALUES ($1,$2,'void',$3,$4,'0.00',$5,$6)`,
    [p.customer_id, paymentId, `Payment voided: ${reason}`, num(p.amount).toFixed(2),
     balance.toFixed(2), JSON.stringify({ reason })]);
  return balance;
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n--- Test 1: settle a partly-paid order (confirmed) ---");
await q(`INSERT INTO customers (id,name) VALUES (1,'Sagar Kharal')`);
await q(`INSERT INTO products (id,name,stock_quantity,price) VALUES (1,'Aalu 1kg',100,75)`);
await q(`INSERT INTO orders (id,customer_id,customer_name,total_amount,amount_paid,payment_status,payment_method)
         VALUES (4,1,'Sagar Kharal',75,50,'partial','khalti')`);

const r1 = await settleOrder(4, "confirmed", "khalti");
check("records only the NPR 25 still owed, not the full 75", r1.recorded === 25, `recorded ${r1.recorded}`);
const led1 = await one(`SELECT credit_amount FROM customer_ledger WHERE entry_type='payment' ORDER BY id DESC LIMIT 1`);
check("ledger credit entry is 25", num(led1.credit_amount) === 25, `ledger ${num(led1.credit_amount)}`);
const ord1 = await one(`SELECT * FROM orders WHERE id=4`);
check("order becomes fully paid with amount_paid = total",
  ord1.payment_status === "paid" && num(ord1.amount_paid) === 75, `${ord1.payment_status}/${num(ord1.amount_paid)}`);

let doubleSettleBlocked = false;
try { await settleOrder(4, "confirmed"); } catch (e) { doubleSettleBlocked = e.message === "ALREADY_PAID"; }
check("settling an already-paid order is refused", doubleSettleBlocked);

console.log("\n--- Test 2: move a partly-paid order to the credit tab ---");
await q(`INSERT INTO customers (id,name,credit_balance) VALUES (2,'Sita Poudel',200)`);
await q(`INSERT INTO orders (id,customer_id,customer_name,total_amount,amount_paid,payment_status)
         VALUES (5,2,'Sita Poudel',1000,400,'partial')`);
const r2 = await settleOrder(5, "credit");
check("adds only the NPR 600 outstanding to udharo", r2.credited === 600, `credited ${r2.credited}`);
const c2 = await one(`SELECT credit_balance FROM customers WHERE id=2`);
check("balance goes 200 -> 800 (not 1200)", num(c2.credit_balance) === 800, `balance ${num(c2.credit_balance)}`);

let doubleCreditBlocked = false;
try { await settleOrder(5, "credit"); } catch (e) { doubleCreditBlocked = e.message === "ALREADY_CREDITED"; }
check("a second tap cannot double the customer's debt", doubleCreditBlocked);
const c2b = await one(`SELECT credit_balance FROM customers WHERE id=2`);
check("balance unchanged after the blocked second tap", num(c2b.credit_balance) === 800, `balance ${num(c2b.credit_balance)}`);

console.log("\n--- Test 3: void a mistyped invoice (5000 instead of 500) ---");
await q(`INSERT INTO customers (id,name) VALUES (3,'Ram Bahadur')`);
await q(`INSERT INTO products (id,name,stock_quantity,price) VALUES (2,'Rice 25kg',40,2650)`);
const balanceBefore = num((await one(`SELECT credit_balance FROM customers WHERE id=3`)).credit_balance);
const stockBefore = Number((await one(`SELECT stock_quantity FROM products WHERE id=2`)).stock_quantity);

await q(`INSERT INTO invoices (id,customer_id,invoice_number,subtotal_amount,amount_paid,reward_points_earned)
         VALUES (10,3,'INV-WRONG',5000,1000,50)`);
await q(`INSERT INTO invoice_items (invoice_id,product_id,product_name,quantity) VALUES (10,2,'Rice 25kg',10)`);
await q(`INSERT INTO customer_payments (id,customer_id,invoice_id,amount) VALUES (50,3,10,1000)`);
await q(`UPDATE products SET stock_quantity = stock_quantity - 10 WHERE id=2`);
await q(`UPDATE customers SET reward_points = reward_points + 50, total_spent = total_spent + 5000 WHERE id=3`);
await recalcBalance(3);
const balanceWrong = num((await one(`SELECT credit_balance FROM customers WHERE id=3`)).credit_balance);
check("wrong invoice creates a 4000 due (5000 - 1000 paid)", balanceWrong === 4000, `balance ${balanceWrong}`);

await voidInvoice(10, "typed 5000 instead of 500");
const c3 = await one(`SELECT * FROM customers WHERE id=3`);
const p3 = await one(`SELECT stock_quantity FROM products WHERE id=2`);
check("balance returns exactly to the pre-mistake value",
  num(c3.credit_balance) === balanceBefore, `${num(c3.credit_balance)} vs ${balanceBefore}`);
check("stock returns exactly to the pre-mistake value",
  Number(p3.stock_quantity) === stockBefore, `${p3.stock_quantity} vs ${stockBefore}`);
check("reward points taken back", Number(c3.reward_points) === 0, `points ${c3.reward_points}`);
check("total spent taken back", num(c3.total_spent) === 0, `spent ${num(c3.total_spent)}`);
const voidedInv = await one(`SELECT voided_at, void_reason FROM invoices WHERE id=10`);
check("invoice kept for audit, marked voided with reason",
  !!voidedInv.voided_at && voidedInv.void_reason === "typed 5000 instead of 500");
const voidedPay = await one(`SELECT voided_at FROM customer_payments WHERE id=50`);
check("the payment collected with that invoice is voided too", !!voidedPay.voided_at);

let doubleVoid = false;
try { await voidInvoice(10, "again"); } catch (e) { doubleVoid = e.message === "ALREADY_VOIDED"; }
check("an invoice cannot be voided twice", doubleVoid);

console.log("\n--- Test 4: re-enter the correct invoice after the void ---");
await q(`INSERT INTO invoices (id,customer_id,invoice_number,subtotal_amount,amount_paid,reward_points_earned)
         VALUES (11,3,'INV-RIGHT',500,0,5)`);
await q(`INSERT INTO invoice_items (invoice_id,product_id,product_name,quantity) VALUES (11,2,'Rice 25kg',1)`);
await q(`UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id=2`);
await q(`UPDATE customers SET reward_points = reward_points + 5, total_spent = total_spent + 500 WHERE id=3`);
const balCorrect = await recalcBalance(3);
check("correct invoice leaves a 500 due", balCorrect === 500, `balance ${balCorrect}`);
const p3b = await one(`SELECT stock_quantity FROM products WHERE id=2`);
check("stock reflects only the real sale (40 - 1 = 39)", Number(p3b.stock_quantity) === 39, `stock ${p3b.stock_quantity}`);

console.log("\n--- Test 5: void a mistyped customer payment ---");
await q(`INSERT INTO customer_payments (id,customer_id,amount) VALUES (51,3,500)`);
const afterPay = await recalcBalance(3);
check("payment of 500 clears the due", afterPay === 0, `balance ${afterPay}`);
const afterVoidPay = await voidPayment(51, "entered on the wrong customer");
check("voiding that payment restores the 500 due", afterVoidPay === 500, `balance ${afterVoidPay}`);
const ledV = await one(`SELECT debit_amount FROM customer_ledger WHERE payment_id=51 AND entry_type='void'`);
check("a reversing ledger entry of 500 is recorded", num(ledV.debit_amount) === 500, `debit ${num(ledV.debit_amount)}`);

console.log("\n--- Test 6: dashboard revenue and pending counts with partial payments ---");
await q(`DELETE FROM orders`);
await q(`INSERT INTO orders (customer_id,customer_name,total_amount,amount_paid,payment_status,status) VALUES
  (1,'A',1000,1000,'paid','delivered'),
  (1,'B',1000,300,'partial','preparing'),
  (1,'C',1000,0,'unpaid','order-received'),
  (1,'D',1000,0,'unpaid','cancelled')`);
const stats = await one(`
  SELECT
    sum(case when payment_status in ('unpaid','partial') and status not in ('cancelled','delivered') then 1 else 0 end)::int AS pending,
    coalesce(sum(case when payment_status = 'paid' then total_amount::numeric else coalesce(amount_paid::numeric,0) end),0) AS revenue
  FROM orders`);
check("revenue counts money actually received (1000 + 300 = 1300)",
  num(stats.revenue) === 1300, `revenue ${num(stats.revenue)}`);
check("pending payment counts the partial and unpaid, excludes cancelled/delivered (2)",
  Number(stats.pending) === 2, `pending ${stats.pending}`);

console.log("\n--- Test 7: proof register amounts for a partly-paid order ---");
const reg = await one(`SELECT total_amount, amount_paid, payment_status FROM orders WHERE customer_name='B'`);
const regPaid = reg.payment_status === "paid" ? num(reg.total_amount) : num(reg.amount_paid);
const regDue = reg.payment_status === "paid" ? 0 : Math.max(num(reg.total_amount) - num(reg.amount_paid), 0);
check("register shows 300 received and 700 due (not 0 and 1000)",
  regPaid === 300 && regDue === 700, `paid ${regPaid}, due ${regDue}`);

console.log("\n--- Test 8: walk-in customer cannot be given credit ---");
await q(`INSERT INTO customers (id,name,customer_code) VALUES (9,'Walk-in Customer','WALK-IN')`);
const walkIn = await one(`SELECT * FROM customers WHERE id=9`);
const WALK_IN_CODE = "WALK-IN";
const tryWalkIn = (subtotal, amountPaid) => {
  const previousDue = num(walkIn.credit_balance);
  const total = subtotal + previousDue;
  const due = Math.max(total - amountPaid, 0);
  if (walkIn.customer_code === WALK_IN_CODE && due > 0) throw new Error("WALK_IN_CREDIT_NOT_ALLOWED");
  return due;
};
let walkInBlocked = false;
try { tryWalkIn(500, 200); } catch (e) { walkInBlocked = e.message === "WALK_IN_CREDIT_NOT_ALLOWED"; }
check("a part-paid walk-in sale is refused", walkInBlocked);
let walkInCashOk = false;
try { walkInCashOk = tryWalkIn(500, 500) === 0; } catch { walkInCashOk = false; }
check("a fully-paid walk-in cash sale is allowed", walkInCashOk);

console.log("\n--- Test 9: invoice numbers stay unique within the same second ---");
// Mirrors buildInvoiceNumber() in business.ts: date prefix + the row id, so
// bills saved in the same second cannot share a number.
const invoiceDatePrefix = () => {
  const n = new Date();
  return [n.getFullYear(), String(n.getMonth() + 1).padStart(2, "0"), String(n.getDate()).padStart(2, "0")].join("");
};
const numbers = [];
for (let i = 0; i < 5; i++) {
  const row = await one(
    `INSERT INTO invoices (customer_id, invoice_number, subtotal_amount)
     VALUES (1, $1, 100) RETURNING id`, [`INV-${invoiceDatePrefix()}-PENDING`]);
  const finalNumber = `INV-${invoiceDatePrefix()}-${String(row.id).padStart(4, "0")}`;
  await q(`UPDATE invoices SET invoice_number=$1 WHERE id=$2`, [finalNumber, row.id]);
  numbers.push(finalNumber);
}
check("five bills created back-to-back all get different numbers",
  new Set(numbers).size === 5, numbers.join(", "));
const stored = await q(
  `SELECT count(*)::int AS total, count(distinct invoice_number)::int AS distinct_numbers
   FROM invoices WHERE invoice_number LIKE 'INV-%-0%'`);
check("stored numbers are distinct in the database",
  stored[0].total === stored[0].distinct_numbers,
  `${stored[0].total} rows, ${stored[0].distinct_numbers} distinct`);
check("no bill is left with the PENDING placeholder",
  (await q(`SELECT id FROM invoices WHERE invoice_number LIKE '%PENDING%'`)).length === 0);

console.log("\n--- Test 10: profit uses the cost recorded at the time of sale ---");
// Mirrors the gross-profit block in GET /admin/analytics. The point of storing
// unit_cost on each line is that a later price change must not rewrite history.
await q(`DELETE FROM invoice_items`);
await q(`DELETE FROM invoices`);
await q(`INSERT INTO invoices (id,customer_id,invoice_number,subtotal_amount) VALUES
  (200,1,'INV-P1',3000),
  (201,1,'INV-P2',1000)`);
// Rice: sold 2 @ 1500, cost 1000 each -> profit 1000
// Salt: sold 10 @ 30 (line 300), cost 32 each -> LOSS of 20
await q(`INSERT INTO invoice_items (invoice_id,product_id,product_name,quantity,unit,unit_price,unit_cost,line_total) VALUES
  (200,1,'Rice 25kg',2,'bora',1500,1000,3000),
  (201,2,'Salt 1kg',10,'kg',30,32,300)`);
// A voided invoice must not count toward profit at all.
await q(`INSERT INTO invoices (id,customer_id,invoice_number,subtotal_amount,voided_at) VALUES
  (202,1,'INV-VOID',9999,now())`);
await q(`INSERT INTO invoice_items (invoice_id,product_id,product_name,quantity,unit,unit_price,unit_cost,line_total) VALUES
  (202,1,'Rice 25kg',50,'bora',1500,1000,75000)`);

const lines = await q(`
  SELECT ii.product_id, ii.product_name, ii.quantity, ii.line_total, ii.unit_cost
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE i.voided_at IS NULL`);

let revenue = 0, cost = 0;
const perProduct = new Map();
for (const l of lines) {
  const r = num(l.line_total), c = num(l.unit_cost) * Number(l.quantity);
  revenue += r; cost += c;
  const e = perProduct.get(l.product_id) ?? { name: l.product_name, revenue: 0, cost: 0 };
  e.revenue += r; e.cost += c; perProduct.set(l.product_id, e);
}
const gross = revenue - cost;
const margin = revenue > 0 ? (gross / revenue) * 100 : 0;

check("revenue counts only non-voided sales (3000 + 300)", revenue === 3300, `revenue ${revenue}`);
check("cost uses the unit cost stored on each line (2000 + 320)", cost === 2320, `cost ${cost}`);
check("gross profit is revenue minus that cost (980)", gross === 980, `profit ${gross}`);
check("margin is profit as a share of sales (~29.7%)", Math.abs(margin - 29.6969) < 0.01, `${margin.toFixed(2)}%`);

const rice = perProduct.get(1);
const salt = perProduct.get(2);
check("the voided 75,000 sale is excluded from the product breakdown",
  rice.revenue === 3000, `rice revenue ${rice.revenue}`);
check("an item sold below cost shows as a loss", salt.revenue - salt.cost === -20,
  `salt profit ${salt.revenue - salt.cost}`);

// A later price change must not alter what past sales earned.
await q(`UPDATE products SET price = 99999 WHERE id = 1`);
const afterRepricing = await one(`
  SELECT coalesce(sum(ii.line_total),0) AS r FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id WHERE i.voided_at IS NULL`);
check("changing a product's price today does not rewrite past profit",
  num(afterRepricing.r) === 3300, `revenue still ${num(afterRepricing.r)}`);

console.log("\n--- Test 11: udharo ageing puts the longest debts first ---");
// Mirrors GET /admin/credit-analysis: age a debt from the last payment, or
// from the oldest unpaid bill when the customer has never paid anything.
await q(`DELETE FROM customer_ledger`);
await q(`DELETE FROM customer_payments`);
await q(`DELETE FROM invoice_items`);
await q(`DELETE FROM invoices`);
await q(`DELETE FROM customers`);

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
await q(`INSERT INTO customers (id,name,credit_balance) VALUES
  (1,'Paid last week',500),
  (2,'Quiet 45 days',1200),
  (3,'Silent 6 months',3000),
  (4,'Never paid',800),
  (5,'Owes nothing',0)`);
await q(`INSERT INTO customer_payments (customer_id,amount,created_at) VALUES
  (1,100,$1),(2,100,$2),(3,100,$3)`, [daysAgo(7), daysAgo(45), daysAgo(180)]);
// The never-payer has an old unpaid bill instead of any payment.
await q(`INSERT INTO invoices (id,customer_id,invoice_number,subtotal_amount,due_amount,created_at)
         VALUES (900,4,'INV-OLD',800,800,$1)`, [daysAgo(90)]);
// A voided payment must not count as "recently paid".
await q(`INSERT INTO customer_payments (customer_id,amount,created_at,voided_at)
         VALUES (3,100,$1,now())`, [daysAgo(1)]);

const aged = await q(`
  SELECT c.id, c.name, c.credit_balance,
    (SELECT max(cp.created_at) FROM customer_payments cp
      WHERE cp.customer_id = c.id AND cp.voided_at IS NULL) AS last_payment_at,
    (SELECT min(i.created_at) FROM invoices i
      WHERE i.customer_id = c.id AND i.voided_at IS NULL AND i.due_amount > 0) AS first_unpaid_at
  FROM customers c WHERE c.credit_balance > 0`);

const nowMs = Date.now();
const since = (v) => (v ? Math.floor((nowMs - new Date(v).getTime()) / 86400000) : null);
const analysed = aged
  .map((r) => {
    const age = since(r.last_payment_at) ?? since(r.first_unpaid_at) ?? 0;
    return {
      name: r.name,
      balance: num(r.credit_balance),
      neverPaid: r.last_payment_at === null,
      age,
      bucket: age > 60 ? "over60" : age > 30 ? "days31to60" : "days0to30",
    };
  })
  .sort((a, b) => b.age - a.age || b.balance - a.balance);

check("customers with no due are left out", analysed.length === 4, `${analysed.length} listed`);
check("the longest-standing debt is listed first", analysed[0].name === "Silent 6 months", analysed[0].name);
check("a recent payer lands in the under-a-month bucket",
  analysed.find((c) => c.name === "Paid last week").bucket === "days0to30");
check("45 days lands in the 1-2 month bucket",
  analysed.find((c) => c.name === "Quiet 45 days").bucket === "days31to60");
check("6 months lands in the over-2-month bucket",
  analysed.find((c) => c.name === "Silent 6 months").bucket === "over60");
check("a voided payment does not make an old debt look recent",
  analysed.find((c) => c.name === "Silent 6 months").age >= 179, `age ${analysed.find((c) => c.name === "Silent 6 months").age}`);
const never = analysed.find((c) => c.name === "Never paid");
check("someone who never paid is aged from their oldest bill, not treated as new",
  never.neverPaid === true && never.age >= 89, `neverPaid=${never.neverPaid} age=${never.age}`);
const over60 = analysed.filter((c) => c.bucket === "over60");
check("over-2-month bucket totals only those debts",
  over60.reduce((s, c) => s + c.balance, 0) === 3800, `${over60.reduce((s, c) => s + c.balance, 0)}`);

// ══════════════════════════════════════════════════════════════════════════
const failed = results.filter((r) => !r.pass);
console.log(`\n${"=".repeat(64)}`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) console.log(`  - ${f.name} (${f.detail})`);
}
process.exit(failed.length ? 1 : 0);
