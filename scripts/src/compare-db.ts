import { Client } from "pg";

const TABLES = [
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

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function buildClient(connectionString: string, allowSelfSigned = false) {
  const ssl =
    connectionString.includes("sslmode=require") || connectionString.includes("sslmode=verify-full")
      ? allowSelfSigned
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true }
      : undefined;

  return new Client({ connectionString, ssl });
}

async function getCount(client: Client, table: string) {
  const result = await client.query(`select count(*)::int as count from "${table}"`);
  return Number(result.rows[0]?.count ?? 0);
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
    console.log("Comparing source and target row counts...");
    let mismatches = 0;
    for (const table of TABLES) {
      const [sourceCount, targetCount] = await Promise.all([getCount(source, table), getCount(target, table)]);
      const status = sourceCount === targetCount ? "OK" : "MISMATCH";
      if (status === "MISMATCH") mismatches += 1;
      console.log(`${table}: source=${sourceCount} target=${targetCount} ${status}`);
    }
    if (mismatches > 0) {
      throw new Error(`Found ${mismatches} table count mismatches`);
    }
    console.log("Database counts match.");
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error("Compare failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
