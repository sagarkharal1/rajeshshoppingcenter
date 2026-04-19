import { Client } from "pg";

const TABLES_IN_COPY_ORDER = [
  "settings",
  "categories",
  "products",
  "customers",
  "orders",
  "bookings",
  "invoices",
  "invoice_items",
  "customer_payments",
  "customer_ledger",
  "reward_transactions",
] as const;

type TableName = (typeof TABLES_IN_COPY_ORDER)[number];

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function buildClient(connectionString: string, allowSelfSigned = false) {
  const ssl =
    connectionString.includes("sslmode=require") || connectionString.includes("sslmode=verify-full")
      ? allowSelfSigned
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true }
      : undefined;

  return new Client({
    connectionString,
    ssl,
  });
}

async function getTableColumns(client: Client, table: TableName): Promise<string[]> {
  const result = await client.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position
    `,
    [table],
  );
  return result.rows.map((row: { column_name: string }) => row.column_name);
}

async function truncateTargetTables(client: Client) {
  const tables = TABLES_IN_COPY_ORDER.map((table) => quoteIdent(table)).join(", ");
  await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

async function copyTable(source: Client, target: Client, table: TableName) {
  const columns = await getTableColumns(source, table);
  if (!columns.length) {
    throw new Error(`No columns found for table ${table}`);
  }

  const orderBy = columns.includes("id") ? ` order by ${quoteIdent("id")} asc` : "";
  const sourceRows = await source.query(`select * from ${quoteIdent(table)}${orderBy}`);

  if (!sourceRows.rows.length) {
    console.log(`${table}: 0 rows`);
    return;
  }

  const quotedColumns = columns.map(quoteIdent).join(", ");
  for (const row of sourceRows.rows) {
    const values = columns.map((column) => normalizeValue(row[column]));
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    await target.query(
      `insert into ${quoteIdent(table)} (${quotedColumns}) values (${placeholders})`,
      values,
    );
  }

  if (columns.includes("id")) {
    await target.query(
      `
        select setval(
          pg_get_serial_sequence($1, 'id'),
          coalesce((select max(id) from ${quoteIdent(table)}), 1),
          true
        )
      `,
      [`public.${table}`],
    );
  }

  console.log(`${table}: ${sourceRows.rows.length} rows`);
}

async function main() {
  const sourceUrl = requireEnv("SOURCE_DATABASE_URL");
  const targetUrl = requireEnv("TARGET_DATABASE_URL");
  const sourceAllowSelfSigned = process.env.SOURCE_DB_SSL_NO_VERIFY === "1";
  const targetAllowSelfSigned = process.env.TARGET_DB_SSL_NO_VERIFY === "1";

  const source = buildClient(sourceUrl, sourceAllowSelfSigned);
  const target = buildClient(targetUrl, targetAllowSelfSigned);

  await source.connect();
  await target.connect();

  try {
    await target.query("BEGIN");
    await truncateTargetTables(target);

    for (const table of TABLES_IN_COPY_ORDER) {
      await copyTable(source, target, table);
    }

    await target.query("COMMIT");
    console.log("Migration complete.");
  } catch (error) {
    await target.query("ROLLBACK");
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error("Migration failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
