import { auditLogsTable, type AuditLogInsert } from "@workspace/db/schema";

export async function logAuditEntry(
  tx: any,
  entry: AuditLogInsert
): Promise<void> {
  await tx.insert(auditLogsTable).values(entry);
}

export function createAuditEntry(opts: {
  entityType: "order" | "booking" | "customer" | "product";
  entityId: number;
  action: "create" | "update" | "delete";
  oldValues?: Record<string, any>;
  newValues: Record<string, any>;
  changedBy?: string;
  metadata?: Record<string, any>;
}): AuditLogInsert {
  return {
    entityType: opts.entityType,
    entityId: opts.entityId,
    action: opts.action,
    oldValues: opts.oldValues || null,
    newValues: opts.newValues,
    changedBy: opts.changedBy || "admin",
    metadata: opts.metadata || {},
  };
}
