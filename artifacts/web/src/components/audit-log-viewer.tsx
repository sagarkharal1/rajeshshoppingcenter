"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, History } from "lucide-react";

interface AuditLog {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  changedBy: string;
  oldValues?: Record<string, any>;
  newValues: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface AuditLogViewerProps {
  entityType: "order" | "booking" | "customer" | "product";
  entityId: number;
  lang?: "en" | "ne";
}

const labels = {
  en: {
    auditHistory: "Audit History",
    loading: "Loading audit history...",
    noHistory: "No changes recorded",
    changedBy: "Changed by",
    action: "Action",
    timestamp: "Timestamp",
    changes: "Changes",
    oldValue: "Old Value",
    newValue: "New Value",
  },
  ne: {
    auditHistory: "परिवर्तन इतिहास",
    loading: "परिवर्तन इतिहास लोड हुँदैछ...",
    noHistory: "कुनै परिवर्तन दर्ज छैन",
    changedBy: "परिवर्तन गरेको",
    action: "कार्य",
    timestamp: "समय",
    changes: "परिवर्तनहरु",
    oldValue: "पुरानो मान",
    newValue: "नयाँ मान",
  },
};

export function AuditLogViewer({ entityType, entityId, lang = "en" }: AuditLogViewerProps) {
  const dict = labels[lang];
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/admin/audit-logs?entityType=${entityType}&entityId=${entityId}&limit=100`
        );
        if (response.ok) {
          const data = await response.json();
          setLogs(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch audit logs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-center text-sm text-slate-500">{dict.loading}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-center text-sm text-slate-500">{dict.noHistory}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-slate-600" />
        <h4 className="text-sm font-semibold text-slate-700">{dict.auditHistory}</h4>
      </div>

      {logs.map((log) => {
        const isExpanded = expandedLogId === log.id;
        const timestamp = new Date(log.createdAt);
        const formattedTime = timestamp.toLocaleString();

        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                    {log.action}
                  </span>
                  <span className="text-xs text-slate-600">{log.changedBy || "admin"}</span>
                </div>
                <p className="text-xs text-slate-500">{formattedTime}</p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-600 transition ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-200 bg-white px-4 py-3 space-y-3 max-h-96 overflow-y-auto"
                >
                  {log.oldValues && Object.keys(log.oldValues).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-700">{dict.changes}</p>
                      {Object.entries(log.oldValues).map(([key, oldVal]) => {
                        const newVal = log.newValues[key];
                        if (oldVal === newVal) return null;

                        return (
                          <div key={key} className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded bg-red-50 p-2">
                              <p className="text-red-700 font-semibold mb-1">{key}</p>
                              <p className="text-red-600">
                                {oldVal === null || oldVal === undefined ? "—" : String(oldVal)}
                              </p>
                            </div>
                            <div className="rounded bg-green-50 p-2">
                              <p className="text-green-700 font-semibold mb-1">{key}</p>
                              <p className="text-green-600">
                                {newVal === null || newVal === undefined ? "—" : String(newVal)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
