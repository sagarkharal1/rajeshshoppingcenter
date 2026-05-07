import { createJsonBackup, createSqlBackup, cleanupOldBackups } from "./backup.js";
import { getRemoteBackupConfig, uploadBackupToRemote } from "./remote-backup.js";
import { logger } from "./logger.js";

type BackupFormat = "json" | "sql";

type ScheduledBackupState = {
  enabled: boolean;
  intervalHours: number;
  format: BackupFormat;
  keepLocalCount: number;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastBackupFilename: string | null;
  lastRemoteUploadAt: string | null;
  lastRemoteKey: string | null;
  lastError: string | null;
  nextRunAt: string | null;
};

let timer: NodeJS.Timeout | null = null;
let state: ScheduledBackupState = {
  enabled: false,
  intervalHours: 24,
  format: "json",
  keepLocalCount: 30,
  running: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastBackupFilename: null,
  lastRemoteUploadAt: null,
  lastRemoteKey: null,
  lastError: null,
  nextRunAt: null,
};

function envFlag(name: string, defaultValue: boolean) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readConfig() {
  const intervalHours = Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS || 24));
  const keepLocalCount = Math.max(1, Number(process.env.BACKUP_KEEP_LOCAL_COUNT || 30));
  const format = process.env.BACKUP_FORMAT === "sql" ? "sql" : "json";
  return {
    enabled: envFlag("BACKUP_SCHEDULE_ENABLED", true),
    intervalHours,
    keepLocalCount,
    format: format as BackupFormat,
  };
}

function scheduleNext(delayMs: number) {
  if (timer) clearTimeout(timer);
  state.nextRunAt = new Date(Date.now() + delayMs).toISOString();
  timer = setTimeout(() => {
    void runScheduledBackup("schedule");
  }, delayMs);
}

export function getScheduledBackupStatus() {
  return {
    ...state,
    remote: getRemoteBackupConfig(),
  };
}

export async function runScheduledBackup(trigger: "schedule" | "manual" = "manual") {
  if (state.running) return getScheduledBackupStatus();
  state.running = true;
  state.lastRunAt = new Date().toISOString();
  state.lastError = null;

  try {
    const metadata = state.format === "sql" ? await createSqlBackup() : await createJsonBackup();
    state.lastBackupFilename = metadata.filename;
    state.lastSuccessAt = new Date().toISOString();

    const remote = await uploadBackupToRemote(metadata.filename);
    if (remote.uploaded) {
      state.lastRemoteUploadAt = new Date().toISOString();
      state.lastRemoteKey = remote.key || null;
    }

    await cleanupOldBackups(state.keepLocalCount);
    logger.info({ trigger, filename: metadata.filename, remoteUploaded: remote.uploaded }, "Scheduled backup completed");
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
    logger.error({ err, trigger }, "Scheduled backup failed");
  } finally {
    state.running = false;
    if (state.enabled) {
      scheduleNext(state.intervalHours * 60 * 60 * 1000);
    }
  }

  return getScheduledBackupStatus();
}

export function startScheduledBackups() {
  const config = readConfig();
  state = {
    ...state,
    enabled: config.enabled,
    intervalHours: config.intervalHours,
    keepLocalCount: config.keepLocalCount,
    format: config.format,
  };

  if (!state.enabled) {
    logger.info("Scheduled backups are disabled");
    return;
  }

  const initialDelayMs = Math.max(30, Number(process.env.BACKUP_START_DELAY_SECONDS || 90)) * 1000;
  scheduleNext(initialDelayMs);
  logger.info(
    {
      intervalHours: state.intervalHours,
      format: state.format,
      remoteConfigured: getRemoteBackupConfig().configured,
      nextRunAt: state.nextRunAt,
    },
    "Scheduled backups started",
  );
}
