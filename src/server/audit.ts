/**
 * Audit logging (Audit log AC 1). Every significant write calls writeAudit
 * inside the SAME transaction as the write, so the log can never drift from the
 * data it describes (tech_stack: "audit log in the same transaction").
 */
import "server-only";
import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";

/** A Drizzle transaction handle (the argument to db.transaction's callback). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface AuditEntry {
  actorUserId: string | null;
  /** e.g. "event.create", "score.confirm", "qualifying.lock", "battle.decide". */
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
}

export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    details: entry.details ?? null,
  });
}
