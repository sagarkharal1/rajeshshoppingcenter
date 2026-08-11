import { db } from "@workspace/db";
import {
  productsTable,
  categoriesTable,
  customersTable,
  ordersTable,
  bookingsTable,
  invoicesTable,
  invoiceItemsTable,
  customerPaymentsTable,
  customerLedgerTable,
  rewardTransactionsTable,
  auditLogsTable,
  stockLedgerTable,
  dealerTransactionsTable,
  settingsTable,
  telegramQueueTable,
} from "@workspace/db/schema";
import { getTableColumns, sql } from "drizzle-orm";
import { createWriteStream, existsSync, unlinkSync } from "fs";
import { readFile } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { gzip, gunzip } from "zlib";
import * as path from "path";

const execAsync = promisify(exec);
const gzipAsync = promisify(gzip);

interface BackupMetadata {
  filename: string;
  format: "json" | "sql";
  timestamp: string;
  size: number;
  tables: number;
  records: number;
  databases: {
    name: string;
    recordCount: number;
  }[];
}

async function getAllData() {
  const timestamp = new Date().toISOString();

  const [
    categories,
    products,
    customers,
    orders,
    bookings,
    invoices,
    invoiceItems,
    payments,
    ledger,
    rewardTransactions,
    auditLogs,
    stockLedger,
    dealerTransactions,
    settings,
    telegramQueue,
  ] = await Promise.all([
    db.select().from(categoriesTable),
    db.select().from(productsTable),
    db.select().from(customersTable),
    db.select().from(ordersTable),
    db.select().from(bookingsTable),
    db.select().from(invoicesTable),
    db.select().from(invoiceItemsTable),
    db.select().from(customerPaymentsTable),
    db.select().from(customerLedgerTable),
    db.select().from(rewardTransactionsTable),
    db.select().from(auditLogsTable),
    db.select().from(stockLedgerTable),
    db.select().from(dealerTransactionsTable),
    db.select().from(settingsTable),
    db.select().from(telegramQueueTable),
  ]);

  return {
    metadata: {
      backupTime: timestamp,
      version: "1.0",
    },
    tables: {
      categories,
      products,
      customers,
      orders,
      bookings,
      invoices,
      invoiceItems,
      payments,
      ledger,
      rewardTransactions,
      auditLogs,
      stockLedger,
      dealerTransactions,
      settings,
      telegramQueue,
    },
  };
}

export async function createJsonBackup(): Promise<BackupMetadata> {
  const data = await getAllData();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.json.gz`;

  const jsonString = JSON.stringify(data, null, 2);
  const buffer = await gzipAsync(Buffer.from(jsonString, "utf-8"));

  const backupDir = path.join(process.cwd(), "backups");
  if (!existsSync(backupDir)) {
    require("fs").mkdirSync(backupDir, { recursive: true });
  }

  const filepath = path.join(backupDir, filename);
  const fs = require("fs").promises;
  await fs.writeFile(filepath, buffer);

  const tableNames = Object.keys(data.tables);
  const totalRecords = Object.values(data.tables).reduce(
    (sum: number, table: any) => sum + (Array.isArray(table) ? table.length : 0),
    0
  );

  const databases = Object.entries(data.tables).map(([name, table]: [string, any]) => ({
    name,
    recordCount: Array.isArray(table) ? table.length : 0,
  }));

  return {
    filename,
    format: "json",
    timestamp: data.metadata.backupTime,
    size: buffer.length,
    tables: tableNames.length,
    records: totalRecords,
    databases,
  };
}

export async function createSqlBackup(): Promise<BackupMetadata> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.sql.gz`;
  const backupDir = path.join(process.cwd(), "backups");

  if (!existsSync(backupDir)) {
    require("fs").mkdirSync(backupDir, { recursive: true });
  }

  const dumpPath = path.join(backupDir, `${timestamp}.sql`);
  const finalPath = path.join(backupDir, filename);

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL environment variable not set");
    }

    // Execute pg_dump
    await execAsync(`pg_dump "${dbUrl}" -F plain > "${dumpPath}"`);

    // Compress the dump
    const fs = require("fs");
    const readStream = fs.createReadStream(dumpPath);
    const writeStream = fs.createWriteStream(finalPath);
    const gzipStream = require("zlib").createGzip();

    await new Promise((resolve, reject) => {
      readStream
        .pipe(gzipStream)
        .pipe(writeStream)
        .on("finish", resolve)
        .on("error", reject);
    });

    // Clean up uncompressed dump
    if (existsSync(dumpPath)) {
      unlinkSync(dumpPath);
    }

    // Get file size and record count
    const stats = require("fs").statSync(finalPath);

    const data = await getAllData();
    const tableNames = Object.keys(data.tables);
    const totalRecords = Object.values(data.tables).reduce(
      (sum: number, table: any) => sum + (Array.isArray(table) ? table.length : 0),
      0
    );

    return {
      filename,
      format: "sql",
      timestamp: new Date().toISOString(),
      size: stats.size,
      tables: tableNames.length,
      records: totalRecords,
      databases: [],
    };
  } catch (error) {
    // Clean up on error
    if (existsSync(dumpPath)) {
      unlinkSync(dumpPath);
    }
    if (existsSync(finalPath)) {
      unlinkSync(finalPath);
    }
    throw error;
  }
}

export async function listLocalBackups(): Promise<BackupMetadata[]> {
  const backupDir = path.join(process.cwd(), "backups");
  if (!existsSync(backupDir)) {
    return [];
  }

  const fs = require("fs");
  const files = fs.readdirSync(backupDir);

  const backups = files
    .filter((f: string) => f.startsWith("backup-") && (f.endsWith(".json.gz") || f.endsWith(".sql.gz")))
    .map((filename: string) => {
      const filepath = path.join(backupDir, filename);
      const stats = fs.statSync(filepath);
      const isJson = filename.endsWith(".json.gz");

      return {
        filename,
        format: isJson ? ("json" as const) : ("sql" as const),
        timestamp: new Date(stats.mtime).toISOString(),
        size: stats.size,
        tables: 14,
        records: 0,
        databases: [],
      };
    })
    .sort((a: BackupMetadata, b: BackupMetadata) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  return backups;
}

export async function deleteLocalBackup(filename: string): Promise<void> {
  if (!filename.match(/^backup-[\d\-]+\.(json|sql)\.gz$/)) {
    throw new Error("Invalid backup filename");
  }

  const backupDir = path.join(process.cwd(), "backups");
  const filepath = path.join(backupDir, filename);

  if (!existsSync(filepath)) {
    throw new Error("Backup file not found");
  }

  unlinkSync(filepath);
}

// Order matters: parents before children on the way in, reverse on the way
// out, so foreign keys are never left dangling mid-restore.
const RESTORE_ORDER: Array<{ key: string; table: any; name: string; hasSerialId: boolean }> = [
  { key: "categories", table: categoriesTable, name: "categories", hasSerialId: true },
  { key: "products", table: productsTable, name: "products", hasSerialId: true },
  { key: "customers", table: customersTable, name: "customers", hasSerialId: true },
  { key: "orders", table: ordersTable, name: "orders", hasSerialId: true },
  { key: "bookings", table: bookingsTable, name: "bookings", hasSerialId: true },
  { key: "invoices", table: invoicesTable, name: "invoices", hasSerialId: true },
  { key: "invoiceItems", table: invoiceItemsTable, name: "invoice_items", hasSerialId: true },
  { key: "payments", table: customerPaymentsTable, name: "customer_payments", hasSerialId: true },
  { key: "ledger", table: customerLedgerTable, name: "customer_ledger", hasSerialId: true },
  { key: "rewardTransactions", table: rewardTransactionsTable, name: "reward_transactions", hasSerialId: true },
  { key: "stockLedger", table: stockLedgerTable, name: "stock_ledger", hasSerialId: true },
  { key: "dealerTransactions", table: dealerTransactionsTable, name: "dealer_transactions", hasSerialId: true },
  { key: "auditLogs", table: auditLogsTable, name: "audit_logs", hasSerialId: true },
  { key: "telegramQueue", table: telegramQueueTable, name: "telegram_queue", hasSerialId: true },
  { key: "settings", table: settingsTable, name: "settings", hasSerialId: true },
];

// Credentials are deliberately NOT taken from the backup: restoring an old
// password (or an old 2FA secret) could lock the owner out of their own shop
// in the middle of a recovery. The current login always survives a restore.
const CREDENTIAL_FIELDS = new Set([
  "adminPasswordHash",
  "adminOtp",
  "adminOtpExpiry",
  "totpSecret",
  "totpEnabled",
]);

/**
 * Rebuild a value for insertion. JSON has no date type, so timestamps come
 * back as ISO strings; only columns the schema declares as timestamps are
 * converted, because some genuinely-text columns (e.g. bookingDate) also hold
 * date-shaped strings and must stay text.
 */
function reviveRow(table: any, row: Record<string, unknown>): Record<string, unknown> {
  const columns = getTableColumns(table) as Record<string, any>;
  const out: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(row)) {
    const column = columns[field];
    if (!column) continue; // column no longer exists in the schema — skip it
    if (value !== null && value !== undefined && String(column.columnType).includes("Timestamp")) {
      const parsed = new Date(value as string);
      out[field] = Number.isNaN(parsed.getTime()) ? null : parsed;
    } else {
      out[field] = value;
    }
  }
  return out;
}

export async function restoreJsonBackup(
  filename: string,
): Promise<{ restored: number; perTable: Record<string, number>; errors: string[] }> {
  if (!filename.match(/^backup-[\d\-]+\.json\.gz$/)) {
    throw new Error("Only JSON backups can be restored");
  }

  const filepath = path.join(process.cwd(), "backups", filename);
  if (!existsSync(filepath)) {
    throw new Error("Backup file not found");
  }

  const gunzipAsync = promisify(gunzip);
  const raw = await readFile(filepath);
  const parsed = JSON.parse((await gunzipAsync(raw)).toString("utf-8"));
  const tables = parsed?.tables;
  if (!tables || typeof tables !== "object") {
    throw new Error("Backup file is not in the expected format");
  }

  const errors: string[] = [];
  const perTable: Record<string, number> = {};
  let restored = 0;

  await db.transaction(async (tx) => {
    // Keep the current admin credentials to carry across the restore.
    const [currentSettings] = await tx.select().from(settingsTable).limit(1);

    for (const entry of [...RESTORE_ORDER].reverse()) {
      await tx.delete(entry.table);
    }

    for (const entry of RESTORE_ORDER) {
      const rows = tables[entry.key];
      if (!Array.isArray(rows) || rows.length === 0) {
        perTable[entry.key] = 0;
        continue;
      }

      const prepared = rows.map((row: Record<string, unknown>) => {
        const revived = reviveRow(entry.table, row);
        if (entry.key === "settings" && currentSettings) {
          for (const field of CREDENTIAL_FIELDS) {
            if (field in (currentSettings as Record<string, unknown>)) {
              revived[field] = (currentSettings as Record<string, unknown>)[field];
            }
          }
        }
        return revived;
      });

      // Chunked so a large history does not build one enormous statement.
      const CHUNK = 200;
      for (let i = 0; i < prepared.length; i += CHUNK) {
        await tx.insert(entry.table).values(prepared.slice(i, i + CHUNK));
      }
      perTable[entry.key] = prepared.length;
      restored += prepared.length;
    }

    // Restored rows keep their original ids, so each serial sequence must be
    // moved past them — otherwise the next insert collides with existing data.
    for (const entry of RESTORE_ORDER) {
      if (!entry.hasSerialId) continue;
      try {
        await tx.execute(sql`
          SELECT setval(
            pg_get_serial_sequence(${entry.name}, 'id'),
            GREATEST(COALESCE((SELECT MAX(id) FROM ${sql.identifier(entry.name)}), 0), 1),
            (SELECT COUNT(*) > 0 FROM ${sql.identifier(entry.name)})
          )
        `);
      } catch (error) {
        errors.push(`Could not reset the id counter for ${entry.name}: ${(error as Error).message}`);
      }
    }
  });

  return { restored, perTable, errors };
}

export async function getBackupStatus(): Promise<{
  lastBackup: string | null;
  backupCount: number;
  totalSize: number;
  oldestBackup: string | null;
}> {
  const backups = await listLocalBackups();

  let totalSize = 0;
  for (const backup of backups) {
    totalSize += backup.size;
  }

  return {
    lastBackup: backups.length > 0 ? backups[0].timestamp : null,
    backupCount: backups.length,
    totalSize,
    oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
  };
}

export async function cleanupOldBackups(keepCount: number = 30): Promise<number> {
  const backups = await listLocalBackups();
  let deleted = 0;

  if (backups.length > keepCount) {
    const toDelete = backups.slice(keepCount);
    for (const backup of toDelete) {
      try {
        await deleteLocalBackup(backup.filename);
        deleted++;
      } catch (error) {
        console.error(`Failed to delete ${backup.filename}:`, error);
      }
    }
  }

  return deleted;
}

export async function setupScheduledBackups(
  intervalHours: number = 6
): Promise<{ enabled: boolean; interval: number; nextBackupIn: string }> {
  // This would be implemented with a cron job or scheduled task
  // For now, return configuration
  const nextBackupDate = new Date(Date.now() + intervalHours * 3600000);

  return {
    enabled: true,
    interval: intervalHours,
    nextBackupIn: nextBackupDate.toISOString(),
  };
}
