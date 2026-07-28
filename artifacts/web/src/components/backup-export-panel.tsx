"use client";

import { useEffect, useState } from "react";
import { DatabaseBackup, Download, RefreshCw, ShieldCheck } from "lucide-react";

type BackupRecord = {
  filename: string;
  format: "json" | "sql";
  timestamp: string;
  size: number;
  tables?: number;
  records?: number;
};

type BackupExportPanelProps = {
  lang?: "en" | "ne";
  api: (url: string, opts?: any) => Promise<any>;
  token?: string;
};

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatWhen(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-NP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function BackupExportPanel({ lang = "en", api, token }: BackupExportPanelProps) {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"" | "json" | "sql" | string>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [listResult, statusResult, scheduleResult] = await Promise.all([
        api("/admin/backup/list"),
        api("/admin/backup/status"),
        api("/admin/backup/schedule/status").catch(() => null),
      ]);
      setBackups(listResult.backups || []);
      setStatus(statusResult.status || statusResult);
      setSchedule(scheduleResult?.schedule || null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : (lang === "ne" ? "ब्याकअप सूची लोड गर्न सकिएन।" : "Could not load backups."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const downloadFile = async (filename: string) => {
    if (!token) throw new Error(lang === "ne" ? "फेरि लगइन गरेर डाउनलोड गर्नुहोस्।" : "Please log in again before downloading.");
    const response = await fetch(`/api/admin/backup/${encodeURIComponent(filename)}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || (lang === "ne" ? "डाउनलोड गर्न सकिएन।" : "Download failed."));
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const createAndDownload = async (format: "json" | "sql") => {
    setBusy(format);
    setError("");
    setNotice("");
    try {
      const result = await api(`/admin/backup/create?format=${format}`, { method: "POST" });
      const filename = result.backup?.filename;
      if (!filename) throw new Error(lang === "ne" ? "ब्याकअप फाइल बनेन।" : "Backup file was not created.");
      await downloadFile(filename);
      setNotice(lang === "ne" ? "ब्याकअप तयार भएर डाउनलोड भयो।" : "Backup created and downloaded.");
      await load();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : (lang === "ne" ? "ब्याकअप बनाउन सकिएन।" : "Could not create backup."));
    } finally {
      setBusy("");
    }
  };

  const downloadExisting = async (filename: string) => {
    setBusy(filename);
    setError("");
    setNotice("");
    try {
      await downloadFile(filename);
      setNotice(lang === "ne" ? "ब्याकअप डाउनलोड भयो।" : "Backup downloaded.");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : (lang === "ne" ? "डाउनलोड गर्न सकिएन।" : "Download failed."));
    } finally {
      setBusy("");
    }
  };

  const runAutomaticBackupNow = async () => {
    setBusy("scheduled");
    setError("");
    setNotice("");
    try {
      const result = await api("/admin/backup/schedule/run-now", { method: "POST" });
      setSchedule(result.schedule || null);
      if (result.schedule?.lastError) throw new Error(result.schedule.lastError);
      setNotice(lang === "ne" ? "स्वचालित ब्याकअप अहिले चल्यो।" : "Automatic backup ran now.");
      await load();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : (lang === "ne" ? "स्वचालित ब्याकअप चलाउन सकिएन।" : "Could not run automatic backup."));
    } finally {
      setBusy("");
    }
  };

  const latest = backups[0];

  return (
    <section className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/30 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseBackup className="h-6 w-6 text-emerald-700" />
            <h3 className="text-2xl font-bold text-slate-950">{lang === "ne" ? "ब्याकअप / एक्सपोर्ट" : "Backup / Export"}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {lang === "ne"
              ? "ग्राहक, उधारो, बिल, भुक्तानी, बुकिङ, डिलर, स्टक र प्रमाण फोटो सुरक्षित राख्नुहोस्।"
              : "Keep customers, credits, invoices, payments, bookings, dealers, stock, and proof photos safe."}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {lang === "ne" ? "ताजा गर्नुहोस्" : "Refresh"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => createAndDownload("json")}
          disabled={Boolean(busy)}
          className="flex min-h-[112px] items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-emerald-400 disabled:opacity-60"
        >
          <span>
            <span className="block text-base font-bold text-slate-950">{lang === "ne" ? "पूर्ण JSON ब्याकअप" : "Full JSON Backup"}</span>
            <span className="mt-1 block text-sm text-slate-500">{lang === "ne" ? "दैनिक सुरक्षित राख्न सबैभन्दा राम्रो।" : "Best for daily safe storage and proof images."}</span>
          </span>
          <Download className="h-6 w-6 shrink-0 text-emerald-700" />
        </button>

        <button
          type="button"
          onClick={() => createAndDownload("sql")}
          disabled={Boolean(busy)}
          className="flex min-h-[112px] items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-blue-400 disabled:opacity-60"
        >
          <span>
            <span className="block text-base font-bold text-slate-950">{lang === "ne" ? "SQL रिस्टोर फाइल" : "SQL Restore File"}</span>
            <span className="mt-1 block text-sm text-slate-500">{lang === "ne" ? "सर्भर वा डेभलपरले डेटाबेस फर्काउन प्रयोग गर्ने।" : "For server restore or developer database recovery."}</span>
          </span>
          <ShieldCheck className="h-6 w-6 shrink-0 text-blue-700" />
        </button>
      </div>

      {busy ? (
        <p className="mt-3 text-sm font-semibold text-slate-600">{lang === "ne" ? "ब्याकअप तयार हुँदैछ..." : "Preparing backup..."}</p>
      ) : null}
      {notice ? <p className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{lang === "ne" ? "भर्खरको ब्याकअप" : "Latest Backup"}</p>
          <p className="mt-1 text-sm font-bold text-slate-950">{latest ? formatWhen(latest.timestamp) : (lang === "ne" ? "अझै छैन" : "None yet")}</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{lang === "ne" ? "सर्भरमा फाइल" : "Server Files"}</p>
          <p className="mt-1 text-sm font-bold text-slate-950">{status?.backupCount ?? backups.length}</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{lang === "ne" ? "कुल साइज" : "Total Size"}</p>
          <p className="mt-1 text-sm font-bold text-slate-950">{formatBytes(status?.totalSize ?? backups.reduce((sum, item) => sum + (item.size || 0), 0))}</p>
        </div>
      </div>

      {schedule ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-950">{lang === "ne" ? "स्वचालित ब्याकअप" : "Automatic Backup"}</p>
              <p className="mt-1 text-xs text-slate-500">
                {schedule.enabled
                  ? (lang === "ne" ? `हरेक ${schedule.intervalHours} घण्टामा ${String(schedule.format).toUpperCase()} ब्याकअप` : `${String(schedule.format).toUpperCase()} backup every ${schedule.intervalHours} hours`)
                  : (lang === "ne" ? "बन्द छ" : "Disabled")}
              </p>
            </div>
            <button
              type="button"
              onClick={runAutomaticBackupNow}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {lang === "ne" ? "अहिले चलाउनुहोस्" : "Run now"}
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{lang === "ne" ? "अर्को समय" : "Next Run"}</p>
              <p className="text-sm font-semibold text-slate-900">{schedule.nextRunAt ? formatWhen(schedule.nextRunAt) : "-"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{lang === "ne" ? "अन्तिम सफल" : "Last Success"}</p>
              <p className="text-sm font-semibold text-slate-900">{schedule.lastSuccessAt ? formatWhen(schedule.lastSuccessAt) : "-"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{lang === "ne" ? "बाहिरी स्टोरेज" : "Outside Storage"}</p>
              <p className={`text-sm font-semibold ${schedule.remote?.configured ? "text-emerald-700" : "text-amber-700"}`}>
                {schedule.remote?.configured
                  ? (lang === "ne" ? "कन्फिगर छ" : "Configured")
                  : (lang === "ne" ? "कन्फिगर गर्न बाँकी" : "Needs setup")}
              </p>
            </div>
          </div>
          {schedule.lastError ? <p className="mt-3 text-xs font-semibold text-rose-700">{schedule.lastError}</p> : null}
          {schedule.remote?.configured && schedule.lastRemoteError ? (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {lang === "ne"
                ? `बाहिरी स्टोरेजमा पठाउन सकिएन: ${schedule.lastRemoteError}`
                : `Could not copy the backup outside the server: ${schedule.lastRemoteError}`}
            </p>
          ) : null}
          {!schedule.remote?.configured ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3">
              <p className="text-xs font-bold text-rose-800">
                {lang === "ne"
                  ? "⚠️ ब्याकअप यही सर्भरभित्रै छ — नयाँ डिप्लोय गर्दा मेटिन्छ।"
                  : "⚠️ Backups are stored inside this server — a new deploy erases them."}
              </p>
              <p className="mt-1 text-xs text-rose-700">
                {lang === "ne"
                  ? "सुरक्षित राख्न DigitalOcean मा निजी Space बनाएर BACKUP_SPACES_* env vars थप्नुहोस्।"
                  : "To keep them safe, create a private Space on DigitalOcean and add the BACKUP_SPACES_* environment variables."}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {backups.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {backups.slice(0, 5).map((backup) => (
            <div key={backup.filename} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div>
                <p className="break-all text-sm font-bold text-slate-950">{backup.filename}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {backup.format.toUpperCase()} · {formatBytes(backup.size)} · {formatWhen(backup.timestamp)}
                  {backup.records ? ` · ${backup.records} records` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadExisting(backup.filename)}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {lang === "ne" ? "डाउनलोड" : "Download"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
