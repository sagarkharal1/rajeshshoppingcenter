/**
 * Backup restore round-trip, against a real Postgres engine (PGlite).
 *
 * A backup nobody has ever restored is a hope, not a backup. This exercises
 * the restore algorithm from artifacts/api-server/src/lib/backup.ts:
 * foreign-key-safe delete and insert ordering, reviving timestamps that JSON
 * flattened into strings, resetting the id sequences so the next insert does
 * not collide with restored rows, and keeping the current admin login rather
 * than the one captured in the backup.
 *
 * The algorithm is mirrored here rather than imported, because the real module
 * binds to the live database connection at import time.
 */
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

await db.exec(`
CREATE TABLE categories (id serial PRIMARY KEY, name text NOT NULL);
-- timestamptz here, though the app's schema mostly uses naive timestamp:
-- PGlite sends dates as UTC but reads naive timestamps back as local time, so
-- a naive column shifts on every read in this engine and would drown the
-- behaviour actually under test. node-postgres writes and reads naive columns
-- consistently in local time, so production round-trips. (The app's use of
-- naive timestamps is still a latent risk if the server's timezone changes —
-- noted, not introduced by restore.)
CREATE TABLE products (
  id serial PRIMARY KEY, name text NOT NULL,
  category_id integer NOT NULL REFERENCES categories(id),
  stock_quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customers (
  id serial PRIMARY KEY, name text NOT NULL,
  credit_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bookings (
  id serial PRIMARY KEY, customer_name text NOT NULL,
  booking_date text NOT NULL,               -- text on purpose: date-shaped string
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invoices (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id),
  invoice_number text NOT NULL,
  subtotal_amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invoice_items (
  id serial PRIMARY KEY,
  invoice_id integer NOT NULL REFERENCES invoices(id),
  product_name text NOT NULL, quantity integer NOT NULL
);
CREATE TABLE settings (
  id serial PRIMARY KEY, shop_name text NOT NULL,
  admin_password_hash text, totp_secret text
);
`);

// Column types, as the schema declares them — this is what tells the restore
// which strings are timestamps and which are genuinely text.
const SCHEMA = {
  categories: { id: "int", name: "text" },
  products: { id: "int", name: "text", category_id: "int", stock_quantity: "int", created_at: "timestamp" },
  customers: { id: "int", name: "text", credit_balance: "numeric", created_at: "timestamp" },
  bookings: { id: "int", customer_name: "text", booking_date: "text", created_at: "timestamp" },
  invoices: { id: "int", customer_id: "int", invoice_number: "text", subtotal_amount: "numeric", created_at: "timestamp" },
  invoice_items: { id: "int", invoice_id: "int", product_name: "text", quantity: "int" },
  settings: { id: "int", shop_name: "text", admin_password_hash: "text", totp_secret: "text" },
};

// Parents first; the restore deletes in reverse.
const RESTORE_ORDER = ["categories", "products", "customers", "bookings", "invoices", "invoice_items", "settings"];
const CREDENTIAL_FIELDS = new Set(["admin_password_hash", "totp_secret"]);

const reviveRow = (table, row) => {
  const cols = SCHEMA[table];
  const out = {};
  for (const [field, value] of Object.entries(row)) {
    if (!cols[field]) continue;
    out[field] = cols[field] === "timestamp" && value != null ? new Date(value) : value;
  }
  return out;
};

async function takeBackup() {
  const tables = {};
  for (const t of RESTORE_ORDER) tables[t] = await q(`SELECT * FROM ${t} ORDER BY id`);
  // Round-trip through JSON exactly as a real backup file does.
  return JSON.parse(JSON.stringify({ tables }));
}

async function restore(backup) {
  const current = await one(`SELECT * FROM settings LIMIT 1`);
  for (const t of [...RESTORE_ORDER].reverse()) await q(`DELETE FROM ${t}`);

  for (const t of RESTORE_ORDER) {
    const rows = backup.tables[t] || [];
    for (const raw of rows) {
      const row = reviveRow(t, raw);
      if (t === "settings" && current) {
        for (const f of CREDENTIAL_FIELDS) row[f] = current[f];
      }
      const fields = Object.keys(row);
      const params = fields.map((_, i) => `$${i + 1}`).join(",");
      await q(`INSERT INTO ${t} (${fields.join(",")}) VALUES (${params})`, Object.values(row));
    }
  }

  for (const t of RESTORE_ORDER) {
    await q(
      `SELECT setval(pg_get_serial_sequence($1,'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM ${t}),0),1),
        (SELECT COUNT(*) > 0 FROM ${t}))`, [t]);
  }
}

// ── Seed a shop with real-looking history ─────────────────────────────────
const soldAt = new Date("2026-07-15T10:30:00.000Z");
await q(`INSERT INTO categories (id,name) VALUES (1,'किराना'),(2,'हार्डवेयर')`);
await q(`INSERT INTO products (id,name,category_id,stock_quantity,created_at) VALUES
  (1,'मुसुरो दाल',1,85,$1),(2,'सिमेन्ट',2,60,$1)`, [soldAt]);
await q(`INSERT INTO customers (id,name,credit_balance,created_at) VALUES
  (1,'राम बहादुर',1500.50,$1),(2,'सीता कुमारी',0,$1)`, [soldAt]);
await q(`INSERT INTO bookings (id,customer_name,booking_date,created_at) VALUES
  (1,'हरि प्रसाद','2026-08-05',$1)`, [soldAt]);
await q(`INSERT INTO invoices (id,customer_id,invoice_number,subtotal_amount,created_at) VALUES
  (1,1,'INV-20260715-0001',2650.00,$1),(2,2,'INV-20260715-0002',500.00,$1)`, [soldAt]);
await q(`INSERT INTO invoice_items (id,invoice_id,product_name,quantity) VALUES
  (1,1,'मुसुरो दाल',3),(2,1,'सिमेन्ट',1),(3,2,'मुसुरो दाल',2)`);
await q(`INSERT INTO settings (id,shop_name,admin_password_hash,totp_secret)
  VALUES (1,'राजेश सिपिङ् सेन्टर','OLD-HASH-FROM-BACKUP','OLD-TOTP')`);

const backup = await takeBackup();
check("backup captured every table",
  RESTORE_ORDER.every((t) => Array.isArray(backup.tables[t])),
  `${Object.keys(backup.tables).length} tables`);

// ── Disaster: everything is wiped and replaced with unrelated data ─────────
for (const t of [...RESTORE_ORDER].reverse()) await q(`DELETE FROM ${t}`);
await q(`INSERT INTO categories (id,name) VALUES (99,'wrong')`);
await q(`INSERT INTO customers (id,name) VALUES (99,'wrong customer')`);
// The owner changed their password after the backup was taken.
await q(`INSERT INTO settings (id,shop_name,admin_password_hash,totp_secret)
  VALUES (1,'wrong','CURRENT-HASH','CURRENT-TOTP')`);

await restore(backup);

// ── Verify ────────────────────────────────────────────────────────────────
const counts = {};
for (const t of RESTORE_ORDER) counts[t] = Number((await one(`SELECT count(*)::int AS n FROM ${t}`)).n);
check("every row came back",
  counts.categories === 2 && counts.products === 2 && counts.customers === 2 &&
  counts.bookings === 1 && counts.invoices === 2 && counts.invoice_items === 3,
  JSON.stringify(counts));

const ram = await one(`SELECT * FROM customers WHERE id=1`);
check("customer name restored exactly (including Nepali)", ram.name === "राम बहादुर", ram.name);
check("udharo balance restored to the paisa", Number(ram.credit_balance) === 1500.50, String(ram.credit_balance));

const inv = await one(`SELECT * FROM invoices WHERE id=1`);
check("invoice number restored", inv.invoice_number === "INV-20260715-0001", inv.invoice_number);
check("invoice keeps its link to the right customer", inv.customer_id === 1, `customer_id ${inv.customer_id}`);
check("timestamp restored as a real date, not a string",
  inv.created_at instanceof Date && inv.created_at.toISOString() === soldAt.toISOString(),
  String(inv.created_at));

const booking = await one(`SELECT * FROM bookings WHERE id=1`);
check("date-shaped text column stayed text (not converted to a date)",
  booking.booking_date === "2026-08-05", JSON.stringify(booking.booking_date));

const items = await q(`SELECT * FROM invoice_items WHERE invoice_id=1 ORDER BY id`);
check("invoice line items restored and still attached", items.length === 2, `${items.length} items`);

const settings = await one(`SELECT * FROM settings LIMIT 1`);
check("shop settings restored from the backup", settings.shop_name === "राजेश सिपिङ् सेन्टर", settings.shop_name);
check("current admin password kept, NOT the one inside the backup",
  settings.admin_password_hash === "CURRENT-HASH", settings.admin_password_hash);
check("current 2FA secret kept, NOT the one inside the backup",
  settings.totp_secret === "CURRENT-TOTP", settings.totp_secret);

// The classic restore bug: sequences left behind, so the next insert collides.
const newCustomer = await one(`INSERT INTO customers (name) VALUES ('नयाँ ग्राहक') RETURNING id`);
check("next new customer gets a fresh id, no collision", newCustomer.id === 3, `got id ${newCustomer.id}`);
const newInvoice = await one(
  `INSERT INTO invoices (customer_id,invoice_number,subtotal_amount) VALUES (1,'INV-NEW',10) RETURNING id`);
check("next new invoice gets a fresh id, no collision", newInvoice.id === 3, `got id ${newInvoice.id}`);

// Restoring twice in a row must be safe.
await restore(backup);
const after = Number((await one(`SELECT count(*)::int AS n FROM customers`)).n);
check("restoring the same backup twice is safe (no duplicates)", after === 2, `${after} customers`);

const failed = results.filter((r) => !r.pass);
console.log(`\n${"=".repeat(64)}`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) console.log(`  - ${f.name} (${f.detail})`);
}
process.exit(failed.length ? 1 : 0);
