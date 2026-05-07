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
  settingsTable,
  telegramQueueTable,
} from "@workspace/db/schema";
import { createWriteStream, existsSync, unlinkSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { gzip } from "zlib";
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

export async function restoreJsonBackup(filename: string): Promise<{ restored: number; errors: string[] }> {
  // This is a placeholder for restore functionality
  // Full implementation would require careful data insertion with transaction handling
  throw new Error(
    "JSON restore not yet implemented. Please implement with care to avoid data loss."
  );
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
